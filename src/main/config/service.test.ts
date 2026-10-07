import { mkdtempSync, rmSync } from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SettingsInput } from '@shared/api'
import { openDb } from '../db'
import type { SecretBox } from '../secrets'
import { ConfigService, GOOGLE_NOT_CONFIGURED } from './service'
import type { GoogleClientEnv } from '../google/oauth'

const fakeBox: SecretBox = {
  available: () => true,
  encrypt: (s) => `enc:${s}`,
  decrypt: (s) => s.replace(/^enc:/, '')
}

let dir: string
let env: GoogleClientEnv
let service: ConfigService

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'photobackup-test-'))
  const db = openDb(path.join(dir, 'test.db'), path.resolve('drizzle'), { localFolder: dir })
  env = {}
  service = new ConfigService(
    db,
    fakeBox,
    () => env,
    () => ({ name: 'vedran', surname: 'arnautovic' })
  )
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const validInput = (): SettingsInput => ({
  localFolder: dir,
  googleDriveLocation: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMn',
  awsLocation: 'https://b.s3.eu-west-2.amazonaws.com/photos',
  folderNamingPattern: '{surname}-photos-{yyyy}-{MM}-{name}',
  storageClass: 'DEEP_ARCHIVE',
  awsAccessKeyId: ''
})

describe('ConfigService', () => {
  it('seeds one Config with two Sources, a Destination and a naming pattern', () => {
    const view = service.getView()
    expect(view.sources.map((s) => [s.type, s.name, s.configured])).toEqual([
      ['local', 'Local folder', true],
      ['remote', 'Google Drive', false]
    ])
    expect(view.sources[1].notConfiguredReason).toBe(GOOGLE_NOT_CONFIGURED)
    expect(view.destination).toEqual({
      name: 'AWS S3',
      location: '',
      storageClass: 'DEEP_ARCHIVE',
      hasCredentials: false,
      accessKeyId: '',
      secretAccessKeyLength: 0
    })
    expect(view.folderNamingPattern).toBe('{surname}-photos-{yyyy}-{MM}-{name}')
    expect(view.google).toEqual({
      clientConfigured: false,
      missingEnv: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'],
      signedIn: false
    })
  })

  it('validates every field', () => {
    const result = service.save({
      localFolder: path.join(dir, 'missing'),
      googleDriveLocation: 'My Photos',
      awsLocation: 'https://example.com',
      folderNamingPattern: '{year}',
      storageClass: 'REDUCED_REDUNDANCY',
      awsAccessKeyId: 'AKIA',
      awsSecretAccessKey: ''
    })
    expect(result.ok).toBe(false)
    expect(Object.keys(!result.ok ? result.errors : {}).sort()).toEqual([
      'awsLocation',
      'awsSecretAccessKey',
      'folderNamingPattern',
      'googleDriveLocation',
      'localFolder',
      'storageClass'
    ])
  })

  it('saves settings and encrypts credentials, which never reach the view', () => {
    expect(
      service.save({
        ...validInput(),
        awsAccessKeyId: 'AKIA1',
        awsSecretAccessKey: 's3cret'
      })
    ).toEqual({ ok: true })
    const view = service.getView()
    expect(view.destination).toMatchObject({
      location: validInput().awsLocation,
      hasCredentials: true,
      accessKeyId: 'AKIA1',
      secretAccessKeyLength: 6
    })
    expect(JSON.stringify(view)).not.toContain('s3cret')
    expect(service.getBackupConfig().destination.credentials).toEqual({
      accessKeyId: 'AKIA1',
      secretAccessKey: 's3cret'
    })

    // Omitting the secret keeps the saved one.
    expect(
      service.save({
        ...validInput(),
        awsAccessKeyId: 'AKIA1',
        folderNamingPattern: 'photos-{yyyy}'
      })
    ).toEqual({ ok: true })
    expect(service.getView().folderNamingPattern).toBe('photos-{yyyy}')
    expect(service.getBackupConfig().destination.credentials).toEqual({
      accessKeyId: 'AKIA1',
      secretAccessKey: 's3cret'
    })
  })

  it('changes just the key ID, keeping the saved secret', () => {
    service.save({ ...validInput(), awsAccessKeyId: 'AKIA1', awsSecretAccessKey: 's3cret' })
    expect(service.save({ ...validInput(), awsAccessKeyId: 'AKIA2' })).toEqual({ ok: true })
    expect(service.getBackupConfig().destination.credentials).toEqual({
      accessKeyId: 'AKIA2',
      secretAccessKey: 's3cret'
    })
  })

  it('needs a key ID when a secret is saved, and removes credentials when both are cleared', () => {
    service.save({ ...validInput(), awsAccessKeyId: 'AKIA1', awsSecretAccessKey: 's3cret' })
    expect(service.save({ ...validInput(), awsAccessKeyId: '' })).toEqual({
      ok: false,
      errors: { awsAccessKeyId: 'Enter the access key ID' }
    })
    expect(service.save({ ...validInput(), awsAccessKeyId: '', awsSecretAccessKey: '' })).toEqual({
      ok: true
    })
    expect(service.getView().destination).toMatchObject({
      hasCredentials: false,
      accessKeyId: '',
      secretAccessKeyLength: 0
    })
  })

  it('marks Google Drive ready once the client is configured, signed in and located', () => {
    env = { clientId: 'id', clientSecret: 'secret' }
    expect(service.getView().sources[1].notConfiguredReason).toBe('Not signed in to Google')
    service.setGoogleRefreshToken('refresh-token')
    expect(service.getView().sources[1].notConfiguredReason).toBe('No Google Drive location set')
    service.save(validInput())
    expect(service.getView().sources[1]).toMatchObject({ configured: true, hasCredentials: true })
    expect(service.getBackupConfig().sources[1].credentials).toBe('refresh-token')
  })

  it('saves the storage class', () => {
    expect(service.save({ ...validInput(), storageClass: 'GLACIER_IR' })).toEqual({ ok: true })
    expect(service.getView().destination.storageClass).toBe('GLACIER_IR')
    expect(service.getBackupConfig().destination.storageClass).toBe('GLACIER_IR')
  })
})
