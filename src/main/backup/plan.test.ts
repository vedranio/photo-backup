import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
  copyFileSync,
  existsSync
} from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { BackupConfig } from '../config/service'
import type { UploadParams } from '../aws/upload'
import type { DriveApi } from '../google/drive'
import { BackupJob } from './job'
import { createPlanner, removeStaleStaging } from './plan'

let dir: string
let photos: string
let uploaded: string

const waitFor = async (cond: () => boolean): Promise<void> => {
  for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => setTimeout(r, 10))
}

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'photobackup-plan-'))
  photos = path.join(dir, 'Pictures')
  mkdirSync(path.join(photos, '2026'), { recursive: true })
  writeFileSync(path.join(photos, 'a.jpg'), 'a'.repeat(100))
  writeFileSync(path.join(photos, '2026', 'b.jpg'), 'b'.repeat(200))
  writeFileSync(path.join(photos, '.DS_Store'), 'x')
  uploaded = path.join(dir, 'uploaded.zip')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function config(overrides: Partial<BackupConfig> = {}): BackupConfig {
  return {
    sources: [
      { id: 1, type: 'local', name: 'Local folder', location: photos, configured: true },
      {
        id: 2,
        type: 'remote',
        name: 'Google Drive',
        location: '1AbCdEfGhIjKlMn',
        configured: true,
        credentials: 'rt'
      }
    ],
    destination: {
      location: { bucket: 'bucket', region: 'eu-west-2', prefix: 'photos/' },
      credentials: { accessKeyId: 'AKIA', secretAccessKey: 's' },
      storageClass: 'STANDARD'
    },
    pattern: '{surname}-photos-{yyyy}-{MM}-{name}',
    identity: { name: 'vedran', surname: 'arnautovic' },
    googleEnv: {},
    ...overrides
  }
}

const fakeDrive = (): DriveApi & { trashed: string[] } => {
  const trashed: string[] = []
  return {
    trashed,
    listFiles: async () => [
      {
        id: 'f1',
        name: 'c.jpg',
        relativePath: 'Trip/c.jpg',
        size: 50
      }
    ],
    download: async (_f, dest) => {
      mkdirSync(path.dirname(dest), { recursive: true })
      writeFileSync(dest, 'c'.repeat(50))
    },
    trash: async (id) => void trashed.push(id),
    accountName: async () => 'Vedran Arnautovic',
    folderName: async () => 'Photos'
  }
}

interface Setup {
  job: BackupJob
  drive: ReturnType<typeof fakeDrive>
  upload: Mock<(p: UploadParams) => Promise<void>>
  trashLocal: Mock<(file: string) => Promise<void>>
}

function setup(cfg: BackupConfig): Setup {
  const drive = fakeDrive()
  const trashLocal = vi.fn<(file: string) => Promise<void>>(async () => undefined)
  const upload = vi.fn(async (p: UploadParams) => {
    copyFileSync(p.file, uploaded)
    p.onProgress(1)
  })
  const job = new BackupJob(
    createPlanner({
      config: () => cfg,
      drive: () => drive,
      upload,
      trashLocal,
      tmpDir: dir
    })
  )
  return { job, drive, upload, trashLocal }
}

describe('backup plan', () => {
  it('downloads, compresses and uploads into the named folder, then cleans up', async () => {
    const { job, drive, upload, trashLocal } = setup(config())
    job.start({ sourceIds: [1, 2], cleanUp: true, month: '2026-09' })
    await waitFor(() => job.snapshot().status !== 'running')

    const snap = job.snapshot()
    expect(snap.error).toBeUndefined()
    expect(snap.status).toBe('succeeded')
    expect(snap.stages.map((s) => [s.id, s.percent])).toEqual([
      ['download', 100],
      ['local', 100],
      ['compress', 100],
      ['upload', 100],
      ['cleanup', 100]
    ])
    expect(snap.result).toEqual({
      itemCount: 3,
      totalBytes: 350,
      destination: expect.stringMatching(
        /^s3:\/\/bucket\/photos\/arnautovic-photos-2026-09-vedran\.zip$/
      )
    })
    expect(upload.mock.calls[0][0]).toMatchObject({
      storageClass: 'STANDARD',
      location: { bucket: 'bucket' }
    })
    expect(statSync(uploaded).size).toBeGreaterThan(0)
    expect(trashLocal).toHaveBeenCalledTimes(2)
    expect(drive.trashed).toEqual(['f1'])
    // Staging is removed once the run ends.
    expect(existsSync(path.dirname(upload.mock.calls[0][0].file))).toBe(false)
  })

  it('skips download and cleanup when not needed', async () => {
    const { job, trashLocal } = setup(config())
    job.start({ sourceIds: [1], cleanUp: false, month: '2026-09' })
    await waitFor(() => job.snapshot().status !== 'running')
    expect(job.snapshot().stages.map((s) => s.id)).toEqual(['local', 'compress', 'upload'])
    expect(trashLocal).not.toHaveBeenCalled()
  })

  it('only gets local files when the local folder is selected', async () => {
    const { job } = setup(config())
    job.start({ sourceIds: [2], cleanUp: true, month: '2026-09' })
    await waitFor(() => job.snapshot().status !== 'running')
    expect(job.snapshot().stages.map((s) => s.id)).toEqual([
      'download',
      'compress',
      'upload',
      'cleanup'
    ])
    expect(job.snapshot().result?.itemCount).toBe(1)
  })

  it('fails with a clear error when AWS or a source isn’t set up', async () => {
    const noAws = setup(
      config({ destination: { location: null, credentials: null, storageClass: 'STANDARD' } })
    )
    noAws.job.start({ sourceIds: [1], cleanUp: false, month: '2026-09' })
    await waitFor(() => noAws.job.snapshot().status !== 'running')
    expect(noAws.job.snapshot()).toMatchObject({
      status: 'failed',
      error: expect.stringMatching(/AWS isn’t set up/)
    })

    const cfg = config()
    cfg.sources[1] = {
      ...cfg.sources[1],
      configured: false,
      notConfiguredReason: 'Google Drive not configured'
    }
    const noGoogle = setup(cfg)
    noGoogle.job.start({ sourceIds: [2], cleanUp: false, month: '2026-09' })
    await waitFor(() => noGoogle.job.snapshot().status !== 'running')
    expect(noGoogle.job.snapshot().error).toBe('Google Drive: Google Drive not configured')
  })
})

describe('backup month', () => {
  it('names the zip after the chosen month, across years', async () => {
    const { job } = setup(config())
    job.start({ sourceIds: [1], cleanUp: false, month: '2025-12' })
    await waitFor(() => job.snapshot().status !== 'running')
    expect(job.snapshot().result?.destination).toBe(
      's3://bucket/photos/arnautovic-photos-2025-12-vedran.zip'
    )
  })

  it('fails without a valid month', async () => {
    const { job, upload } = setup(config())
    job.start({ sourceIds: [1], cleanUp: false, month: '' })
    await waitFor(() => job.snapshot().status !== 'running')
    expect(job.snapshot()).toMatchObject({
      status: 'failed',
      error: 'Choose the month you’re backing up'
    })
    expect(upload).not.toHaveBeenCalled()
  })
})

describe('removeStaleStaging', () => {
  it('removes staging left by dead processes, keeps live ones and unrelated folders', async () => {
    const make = (name: string, owner?: string): string => {
      const p = path.join(dir, name)
      mkdirSync(p)
      if (owner !== undefined) writeFileSync(path.join(p, 'owner.pid'), owner)
      return p
    }
    const dead = make('photobackup-staging-dead01', '999999999')
    const noOwner = make('photobackup-staging-noown1')
    const live = make('photobackup-staging-live01', String(process.pid))
    const other = make('photobackup-test-keepme')

    const removed = await removeStaleStaging(dir)

    expect(removed.sort()).toEqual([dead, noOwner].sort())
    expect(existsSync(dead)).toBe(false)
    expect(existsSync(noOwner)).toBe(false)
    expect(existsSync(live)).toBe(true)
    expect(existsSync(other)).toBe(true)
  })

  it('marks a run’s staging with this process, so it survives a sweep mid-backup', async () => {
    const { job, upload } = setup(config())
    let swept: string[] = ['not run']
    upload.mockImplementationOnce(async (p: UploadParams) => {
      swept = await removeStaleStaging(dir)
      expect(existsSync(p.file)).toBe(true)
    })
    job.start({ sourceIds: [1], cleanUp: false, month: '2026-09' })
    await waitFor(() => job.snapshot().status !== 'running')
    expect(job.snapshot().status).toBe('succeeded')
    expect(swept).toEqual([])
  })
})
