import { createWriteStream } from 'fs'
import { mkdir, stat } from 'fs/promises'
import path from 'path'
import { pipeline } from 'stream/promises'
import type { Readable } from 'stream'
import { google, type drive_v3 } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'

export interface DriveFile {
  id: string
  name: string
  /** Path relative to the backed-up folder, e.g. "2026/IMG_0001.jpg". */
  relativePath: string
  size: number
}

export interface DriveApi {
  listFiles(folderId: string, signal: AbortSignal): Promise<DriveFile[]>
  download(file: DriveFile, dest: string, signal: AbortSignal): Promise<void>
  trash(fileId: string): Promise<void>
  /** The signed-in account's display name (or email). */
  accountName(): Promise<string | undefined>
  folderName(folderId: string): Promise<string | undefined>
}

const FOLDER = 'application/vnd.google-apps.folder'
// Google Docs, Sheets, shortcuts etc. have no binary content to download.
const isNative = (mimeType: string): boolean => mimeType.startsWith('application/vnd.google-apps.')

export function createDriveApi(auth: OAuth2Client): DriveApi {
  const drive: drive_v3.Drive = google.drive({ version: 'v3', auth })

  async function listChildren(
    folderId: string,
    signal: AbortSignal
  ): Promise<drive_v3.Schema$File[]> {
    const files: drive_v3.Schema$File[] = []
    let pageToken: string | undefined
    do {
      const res = await drive.files.list(
        {
          q: `'${folderId}' in parents and trashed = false`,
          fields: 'nextPageToken, files(id, name, mimeType, size)',
          pageSize: 1000,
          pageToken
        },
        { signal }
      )
      files.push(...(res.data.files ?? []))
      pageToken = res.data.nextPageToken ?? undefined
    } while (pageToken)
    return files
  }

  return {
    async listFiles(folderId, signal) {
      const result: DriveFile[] = []
      const seen = new Set<string>()
      const walk = async (id: string, prefix: string): Promise<void> => {
        for (const f of await listChildren(id, signal)) {
          if (!f.id || !f.name || !f.mimeType) continue
          if (f.mimeType === FOLDER) await walk(f.id, path.posix.join(prefix, f.name))
          else if (!isNative(f.mimeType)) {
            // Drive allows duplicate names in a folder; a file system doesn't.
            let relativePath = path.posix.join(prefix, f.name)
            if (seen.has(relativePath)) {
              const { name, ext } = path.posix.parse(f.name)
              relativePath = path.posix.join(prefix, `${name} (${f.id})${ext}`)
            }
            seen.add(relativePath)
            result.push({ id: f.id, name: f.name, relativePath, size: Number(f.size ?? 0) })
          }
        }
      }
      await walk(folderId, '')
      return result
    },

    async download(file, dest, signal) {
      // Already downloaded by an earlier attempt (resume or retry).
      const existing = await stat(dest).catch(() => null)
      if (existing && existing.size === file.size) return
      await mkdir(path.dirname(dest), { recursive: true })
      const res = await drive.files.get(
        { fileId: file.id, alt: 'media' },
        { responseType: 'stream', signal }
      )
      await pipeline(res.data as Readable, createWriteStream(dest), { signal })
    },

    async trash(fileId) {
      await drive.files.update({ fileId, requestBody: { trashed: true } })
    },

    async accountName() {
      const res = await drive.about.get({ fields: 'user(displayName, emailAddress)' })
      return res.data.user?.displayName || res.data.user?.emailAddress || undefined
    },

    async folderName(folderId) {
      const res = await drive.files.get({ fileId: folderId, fields: 'name' })
      return res.data.name || undefined
    }
  }
}
