import { describe, expect, it, vi } from 'vitest'
import type { ConfigView } from '@shared/api'
import type { BackupConfig } from '../config/service'
import { GoogleInfo } from './info'

const view = (): ConfigView => ({
  sources: [
    {
      id: 1,
      type: 'local',
      name: 'Local folder',
      location: '/p',
      hasCredentials: false,
      configured: true
    },
    {
      id: 2,
      type: 'remote',
      name: 'Google Drive',
      location: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMn',
      hasCredentials: true,
      configured: true
    }
  ],
  destination: {
    name: 'AWS S3',
    location: '',
    storageClass: 'DEEP_ARCHIVE',
    hasCredentials: false,
    accessKeyId: '',
    secretAccessKeyLength: 0
  },
  folderNamingPattern: '{yyyy}',
  identity: { name: 'vedran', surname: 'arnautovic' },
  google: { clientConfigured: true, missingEnv: [], signedIn: true }
})

const backup = (credentials?: string): BackupConfig =>
  ({
    sources: [
      {
        id: 2,
        type: 'remote',
        name: 'Google Drive',
        location: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMn',
        configured: true,
        credentials
      }
    ]
  }) as BackupConfig

describe('GoogleInfo', () => {
  it('adds the account and folder names, and caches them', async () => {
    const accountName = vi.fn(async () => 'Vedran Arnautovic')
    const folderName = vi.fn<(id: string) => Promise<string>>(async () => 'Photos')
    const info = new GoogleInfo(() => ({ accountName, folderName }))
    const out = await info.decorate(view(), backup('rt'))
    expect(out.google.accountName).toBe('Vedran Arnautovic')
    expect(out.sources[1].displayLocation).toBe('Photos')
    expect(folderName).toHaveBeenCalledWith('1AbCdEfGhIjKlMn')
    await info.decorate(view(), backup('rt'))
    expect(accountName).toHaveBeenCalledTimes(1)
  })

  it('leaves names out when lookups fail, and waits before retrying', async () => {
    let t = 0
    const accountName = vi.fn(async () => {
      throw new Error('offline')
    })
    const info = new GoogleInfo(
      () => ({ accountName, folderName: accountName }),
      50,
      () => t
    )
    const out = await info.decorate(view(), backup('rt'))
    expect(out.google.accountName).toBeUndefined()
    expect(out.sources[1].displayLocation).toBeUndefined()
    await info.decorate(view(), backup('rt'))
    expect(accountName).toHaveBeenCalledTimes(2) // once each for account and folder
    t = 61_000
    await info.decorate(view(), backup('rt'))
    expect(accountName).toHaveBeenCalledTimes(4)
  })

  it('does nothing when not signed in', async () => {
    const accountName = vi.fn(async () => 'x')
    const info = new GoogleInfo(() => ({ accountName, folderName: accountName }))
    expect(await info.decorate(view(), backup(undefined))).toEqual(view())
    expect(accountName).not.toHaveBeenCalled()
  })
})
