// Turns a backup request into stages: download from Google Drive → compress → upload to AWS → clean up.
import { createWriteStream } from 'fs'
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'fs/promises'
import path from 'path'
import { ZipArchive } from 'archiver'
import type { BackupRequest } from '@shared/api'
import { resolvePattern } from '@shared/pattern'
import type { BackupConfig } from '../config/service'
import { s3Uri } from '../aws/location'
import type { UploadParams } from '../aws/upload'
import type { DriveApi } from '../google/drive'
import { parseMonth } from '@shared/month'
import { parseDriveFolderId } from '../google/location'
import type { Plan, Planner, Stage } from './job'

export interface PlannerDeps {
  config(): BackupConfig
  drive(refreshToken: string): DriveApi
  upload(params: UploadParams): Promise<void>
  /** Moves a local file to the OS trash. */
  trashLocal(file: string): Promise<void>
  tmpDir: string
}

interface Entry {
  /** Where the file is on disk now. */
  file: string
  /** Its path inside the archive. */
  archivePath: string
  size: number
  origin: { kind: 'local' } | { kind: 'drive'; fileId: string }
}

export class PlanError extends Error {}

// Each run stages its Drive downloads and zip in <tmpDir>/photobackup-staging-XXXXXX/,
// with the owning process's ID in OWNER_FILE.
const STAGING_PREFIX = 'photobackup-staging-'
const OWNER_FILE = 'owner.pid'

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    // EPERM: it exists but belongs to someone else.
    return (err as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/**
 * Removes staging folders left behind when photobackup quit or crashed mid-backup. Folders owned by a
 * process that's still running (another photobackup, or this one) are kept. Resolves with what was removed.
 */
export async function removeStaleStaging(tmpDir: string): Promise<string[]> {
  const removed: string[] = []
  for (const dirent of await readdir(tmpDir, { withFileTypes: true })) {
    if (!dirent.isDirectory() || !dirent.name.startsWith(STAGING_PREFIX)) continue
    const dir = path.join(tmpDir, dirent.name)
    const owner = Number(await readFile(path.join(dir, OWNER_FILE), 'utf8').catch(() => ''))
    if (owner > 0 && isRunning(owner)) continue
    await rm(dir, { recursive: true, force: true })
    removed.push(dir)
  }
  return removed
}

interface LocalFile {
  file: string
  relativePath: string
  size: number
}

/**
 * Every visible file under `root`. Progress is reported per top-level entry, since the total isn't
 * known up front; `checkpoint` runs between them so a pause takes effect.
 */
async function listLocalFiles(
  root: string,
  progress: (fraction: number) => void = () => undefined,
  checkpoint: () => Promise<void> = async () => undefined
): Promise<LocalFile[]> {
  const out: LocalFile[] = []
  const walk = async (dir: string): Promise<void> => {
    for (const dirent of await readdir(dir, { withFileTypes: true })) {
      if (dirent.name.startsWith('.')) continue
      const file = path.join(dir, dirent.name)
      if (dirent.isDirectory()) await walk(file)
      else if (dirent.isFile()) {
        out.push({
          file,
          relativePath: path.relative(root, file).split(path.sep).join('/'),
          size: (await stat(file)).size
        })
      }
    }
  }
  const top = (await readdir(root, { withFileTypes: true })).filter((d) => !d.name.startsWith('.'))
  for (const [i, dirent] of top.entries()) {
    await checkpoint()
    const file = path.join(root, dirent.name)
    if (dirent.isDirectory()) await walk(file)
    else if (dirent.isFile())
      out.push({ file, relativePath: dirent.name, size: (await stat(file)).size })
    progress((i + 1) / top.length)
  }
  progress(1)
  return out
}

export function createPlanner(deps: PlannerDeps): Planner {
  return async (request: BackupRequest): Promise<Plan> => {
    const config = deps.config()
    const selected = config.sources.filter((s) => request.sourceIds.includes(s.id))
    if (selected.length === 0) throw new PlanError('Select at least one item to back up')
    for (const s of selected) {
      if (!s.configured) throw new PlanError(`${s.name}: ${s.notConfiguredReason}`)
    }
    const { location, credentials, storageClass } = config.destination
    if (!location || !credentials) {
      throw new PlanError('AWS isn’t set up. Add the AWS location and credentials in Settings.')
    }

    const month = parseMonth(request.month)
    if (!month) throw new PlanError('Choose the month you’re backing up')
    // <prefix><pattern>.zip, e.g. photos/arnautovic-photos-2026-09-vedran.zip
    const key = `${location.prefix}${resolvePattern(config.pattern, month, config.identity)}.zip`

    const staging = await mkdtemp(path.join(deps.tmpDir, STAGING_PREFIX))
    await writeFile(path.join(staging, OWNER_FILE), String(process.pid))
    const archiveFile = path.join(staging, 'backup.zip')

    const local = selected.filter((s) => s.type === 'local')
    const remote = selected.find((s) => s.type === 'remote')
    const drive = remote?.credentials ? deps.drive(remote.credentials) : undefined

    // Filled in by the stages, in order.
    let driveEntries: Entry[] = []
    let localEntries: Entry[] = []
    let entries: Entry[] = []

    const stages: Stage[] = []

    if (remote && drive) {
      stages.push({
        id: 'download',
        async run(ctx) {
          const folderId = parseDriveFolderId(remote.location)
          if (!folderId) throw new Error('The Google Drive location isn’t a folder URL or ID')
          const driveFiles = await drive.listFiles(folderId, ctx.signal)
          const total = driveFiles.reduce((sum, f) => sum + f.size, 0) || driveFiles.length || 1
          let done = 0
          driveEntries = []
          for (const f of driveFiles) {
            await ctx.checkpoint()
            const dest = path.join(staging, 'google-drive', ...f.relativePath.split('/'))
            await drive.download(f, dest, ctx.signal)
            driveEntries.push({
              file: dest,
              archivePath: `${remote.name}/${f.relativePath}`,
              size: f.size,
              origin: { kind: 'drive', fileId: f.id }
            })
            done += f.size || 1
            ctx.progress(done / total)
          }
        }
      })
    }

    if (local.length > 0) {
      stages.push({
        id: 'local',
        async run(ctx) {
          localEntries = []
          for (const [i, s] of local.entries()) {
            const files = await listLocalFiles(
              s.location,
              (fraction) => ctx.progress((i + fraction) / local.length),
              ctx.checkpoint
            )
            for (const f of files) {
              localEntries.push({
                file: f.file,
                archivePath: `${s.name}/${f.relativePath}`,
                size: f.size,
                origin: { kind: 'local' }
              })
            }
          }
        }
      })
    }

    stages.push({
      id: 'compress',
      async run(ctx) {
        entries = [...driveEntries, ...localEntries]
        if (entries.length === 0)
          throw new Error('There’s nothing to back up: the selected items are empty')
        const totalBytes = entries.reduce((sum, e) => sum + e.size, 0) || 1

        const archive = new ZipArchive({ zlib: { level: 6 } })
        const output = createWriteStream(archiveFile)
        const finished = new Promise<void>((resolve, reject) => {
          output.on('close', resolve)
          output.on('error', reject)
          archive.on('error', reject)
        })
        archive.on('progress', ({ fs }) => ctx.progress(fs.processedBytes / totalBytes))
        archive.pipe(output)
        try {
          // One file at a time, so pausing takes effect at the next file.
          for (const e of entries) {
            await ctx.checkpoint()
            const added = new Promise<void>((resolve) => archive.once('entry', () => resolve()))
            archive.file(e.file, { name: e.archivePath })
            await added
          }
          await archive.finalize()
          await finished
        } catch (err) {
          archive.abort()
          throw err
        }
      }
    })

    stages.push({
      id: 'upload',
      abortOnPause: true,
      run: (ctx) =>
        deps.upload({
          location,
          credentials,
          storageClass,
          key,
          file: archiveFile,
          signal: ctx.signal,
          onProgress: ctx.progress
        })
    })

    if (request.cleanUp) {
      stages.push({
        id: 'cleanup',
        async run(ctx) {
          // Only reached after a successful upload. Files go to the trash, never deleted outright.
          let done = 0
          for (const e of entries) {
            await ctx.checkpoint()
            if (e.origin.kind === 'local') await deps.trashLocal(e.file)
            else await drive?.trash(e.origin.fileId)
            ctx.progress(++done / entries.length)
          }
        }
      })
    }

    return {
      stages,
      result: () => ({
        itemCount: entries.length,
        totalBytes: entries.reduce((sum, e) => sum + e.size, 0),
        destination: s3Uri(location.bucket, key)
      }),
      dispose: () => rm(staging, { recursive: true, force: true })
    }
  }
}
