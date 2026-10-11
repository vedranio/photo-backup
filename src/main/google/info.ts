// Names shown in the UI instead of raw ids: the signed-in Google account and the Drive folder.
// Looked up on demand and cached; a failed lookup (offline, revoked) just leaves the name out.
import { createHash } from 'crypto'
import type { ConfigView } from '@shared/api'
import type { BackupConfig } from '../config/service'
import type { DriveApi } from './drive'
import { parseDriveFolderId } from './location'

type Lookups = Pick<DriveApi, 'accountName' | 'folderName'>

const RETRY_AFTER_FAILURE_MS = 60_000

export class GoogleInfo {
  private readonly cache = new Map<string, { value?: string; failedAt?: number }>()

  constructor(
    private readonly drive: (refreshToken: string) => Lookups,
    private readonly timeoutMs = 4000,
    private readonly now: () => number = Date.now
  ) {}

  async decorate(view: ConfigView, backup: BackupConfig): Promise<ConfigView> {
    const remote = backup.sources.find((s) => s.type === 'remote')
    if (!view.google.clientConfigured || !remote?.credentials) return view
    const api = this.drive(remote.credentials)
    const account = createHash('sha256').update(remote.credentials).digest('hex').slice(0, 16)
    const folderId = parseDriveFolderId(remote.location)

    const [accountName, folderName] = await Promise.all([
      this.lookup(`account:${account}`, () => api.accountName()),
      folderId
        ? this.lookup(`folder:${account}:${folderId}`, () => api.folderName(folderId))
        : undefined
    ])
    return {
      ...view,
      google: { ...view.google, ...(accountName && { accountName }) },
      sources: view.sources.map((s) =>
        s.type === 'remote' && folderName ? { ...s, displayLocation: folderName } : s
      )
    }
  }

  private async lookup(
    key: string,
    fetch: () => Promise<string | undefined>
  ): Promise<string | undefined> {
    const hit = this.cache.get(key)
    if (hit?.value) return hit.value
    if (hit?.failedAt !== undefined && this.now() - hit.failedAt < RETRY_AFTER_FAILURE_MS)
      return undefined
    try {
      const value = await Promise.race([
        fetch(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), this.timeoutMs)
        )
      ])
      this.cache.set(key, value ? { value } : { failedAt: this.now() })
      return value
    } catch {
      this.cache.set(key, { failedAt: this.now() })
      return undefined
    }
  }
}
