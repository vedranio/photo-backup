import { existsSync, statSync } from 'fs'
import { eq } from 'drizzle-orm'
import type {
  AwsCredentials,
  ConfigView,
  GoogleClient,
  GoogleStatus,
  Identity,
  SaveResult,
  SettingsInput,
  SourceView
} from '@shared/api'
import { DEFAULT_PATTERN, validatePattern } from '@shared/pattern'
import { isStorageClass } from '@shared/storageClass'
import { CONFIG_ID, type Db } from '../db'
import { destinations, folderNamingConventions, sources } from '../db/schema'
import type { SecretBox } from '../secrets'
import { parseS3Location, type S3Location } from '../aws/location'
import { parseDriveFolderId } from '../google/location'
import { missingGoogleEnv, type GoogleClientEnv } from '../google/oauth'

type SourceRow = typeof sources.$inferSelect

export const GOOGLE_NOT_CONFIGURED = 'Google Drive not configured'

/** What the Google Drive source's (encrypted) credentials hold. */
interface GoogleCredentials {
  refreshToken?: string
  clientId?: string
  clientSecret?: string
}

const GOOGLE_CLIENT_ID_RE = /^[\w.-]+\.apps\.googleusercontent\.com$/

export function validateGoogleClient(
  client: GoogleClient
): Partial<Record<'googleClient', string>> {
  if (!client.clientId.trim() || !client.clientSecret.trim()) {
    return { googleClient: 'Enter both the client ID and the client secret' }
  }
  if (!GOOGLE_CLIENT_ID_RE.test(client.clientId.trim())) {
    return { googleClient: 'The client ID ends in .apps.googleusercontent.com' }
  }
  return {}
}

/** Everything the backup engine needs, with credentials decrypted. Main process only. */
export interface BackupConfig {
  sources: Array<{
    id: number
    type: 'local' | 'remote'
    name: string
    location: string
    configured: boolean
    notConfiguredReason?: string
    /** Google refresh token, for the remote source. */
    credentials?: string
  }>
  destination: {
    location: S3Location | null
    credentials: AwsCredentials | null
    storageClass: string
  }
  pattern: string
  identity: Identity
  googleEnv: GoogleClientEnv
}

export class ConfigService {
  constructor(
    private readonly db: Db,
    private readonly secrets: SecretBox,
    private readonly googleEnv: () => GoogleClientEnv,
    private readonly identity: () => Identity
  ) {}

  private sourceRows(): SourceRow[] {
    return this.db.select().from(sources).where(eq(sources.configId, CONFIG_ID)).all()
  }

  private destinationRow(): typeof destinations.$inferSelect {
    const row = this.db
      .select()
      .from(destinations)
      .where(eq(destinations.configId, CONFIG_ID))
      .get()
    if (!row) throw new Error('Config has no Destination')
    return row
  }

  private pattern(): string {
    return (
      this.db
        .select()
        .from(folderNamingConventions)
        .where(eq(folderNamingConventions.configId, CONFIG_ID))
        .orderBy(folderNamingConventions.id)
        .get()?.pattern ?? DEFAULT_PATTERN
    )
  }

  private googleCredentials(): GoogleCredentials {
    const stored = this.sourceRows().find((s) => s.type === 'remote')?.credentials
    if (!stored) return {}
    const plain = this.secrets.decrypt(stored)
    try {
      const parsed: unknown = JSON.parse(plain)
      if (parsed && typeof parsed === 'object') return parsed as GoogleCredentials
    } catch {
      // Saved before the client could be entered in Settings: just the refresh token.
    }
    return { refreshToken: plain }
  }

  private setGoogleCredentials(next: GoogleCredentials): void {
    if (!this.secrets.available()) {
      throw new Error('Secure storage is unavailable on this machine, so Google can’t be set up')
    }
    this.db
      .update(sources)
      .set({ credentials: this.secrets.encrypt(JSON.stringify(next)) })
      .where(eq(sources.type, 'remote'))
      .run()
  }

  /** The OAuth client to sign in with: the one entered in Settings, else the environment's. */
  googleClient(): GoogleClientEnv {
    const saved = this.googleCredentials()
    if (saved.clientId && saved.clientSecret) {
      return { clientId: saved.clientId, clientSecret: saved.clientSecret }
    }
    return this.googleEnv()
  }

  /** Saves the OAuth client. A different client invalidates the sign-in made with the old one. */
  setGoogleClient(client: GoogleClient): void {
    const saved = this.googleCredentials()
    const clientId = client.clientId.trim()
    const clientSecret = client.clientSecret.trim()
    const same = saved.clientId === clientId && saved.clientSecret === clientSecret
    this.setGoogleCredentials({
      clientId,
      clientSecret,
      ...(same && saved.refreshToken && { refreshToken: saved.refreshToken })
    })
  }

  googleStatus(): GoogleStatus {
    const missingEnv = missingGoogleEnv(this.googleClient())
    return {
      clientConfigured: missingEnv.length === 0,
      missingEnv,
      signedIn: !!this.googleCredentials().refreshToken
    }
  }

  private readiness(
    row: SourceRow,
    google: GoogleStatus
  ): Pick<SourceView, 'configured' | 'notConfiguredReason'> {
    if (row.type === 'local') {
      if (!row.location) return { configured: false, notConfiguredReason: 'No local folder set' }
      if (!isDirectory(row.location))
        return { configured: false, notConfiguredReason: 'Folder not found' }
      return { configured: true }
    }
    if (!google.clientConfigured)
      return { configured: false, notConfiguredReason: GOOGLE_NOT_CONFIGURED }
    if (!google.signedIn)
      return { configured: false, notConfiguredReason: 'Not signed in to Google' }
    if (!row.location)
      return { configured: false, notConfiguredReason: 'No Google Drive location set' }
    return { configured: true }
  }

  private awsCredentials(): AwsCredentials | null {
    const stored = this.destinationRow().credentials
    return stored ? (JSON.parse(this.secrets.decrypt(stored)) as AwsCredentials) : null
  }

  getView(): ConfigView {
    const google = this.googleStatus()
    const dest = this.destinationRow()
    const aws = this.awsCredentials()
    return {
      sources: this.sourceRows().map((row) => ({
        id: row.id,
        type: row.type,
        name: row.name,
        location: row.location,
        hasCredentials: row.type === 'remote' ? google.signedIn : !!row.credentials,
        ...this.readiness(row, google)
      })),
      destination: {
        name: dest.name,
        location: dest.location,
        storageClass: dest.storageClass,
        hasCredentials: !!aws,
        accessKeyId: aws?.accessKeyId ?? '',
        secretAccessKeyLength: aws?.secretAccessKey.length ?? 0
      },
      folderNamingPattern: this.pattern(),
      identity: this.identity(),
      google
    }
  }

  validate(input: SettingsInput): Extract<SaveResult, { ok: false }>['errors'] {
    const errors: Extract<SaveResult, { ok: false }>['errors'] = {}
    if (input.localFolder.trim() && !isDirectory(input.localFolder.trim())) {
      errors.localFolder = 'Folder not found'
    }
    if (input.googleDriveLocation.trim() && !parseDriveFolderId(input.googleDriveLocation)) {
      errors.googleDriveLocation = 'Enter a Google Drive folder URL or folder ID'
    }
    if (input.awsLocation.trim() && !parseS3Location(input.awsLocation)) {
      errors.awsLocation =
        'Enter the bucket’s link from the S3 console, or an S3 URL such as https://my-bucket.s3.eu-west-2.amazonaws.com/photos'
    }
    if (!isStorageClass(input.storageClass)) errors.storageClass = 'Choose a storage class'
    const patternError = validatePattern(input.folderNamingPattern)
    if (patternError) errors.folderNamingPattern = patternError
    if (input.googleClient) {
      Object.assign(errors, validateGoogleClient(input.googleClient))
      if (!errors.googleClient && !this.secrets.available()) {
        errors.googleClient =
          'Secure storage is unavailable on this machine, so Google can’t be set up'
      }
    }
    const aws = this.nextAwsCredentials(input)
    if (aws.idMissing) errors.awsAccessKeyId = 'Enter the access key ID'
    if (aws.secretMissing) errors.awsSecretAccessKey = 'Enter the secret access key'
    if (aws.changed && aws.next && !this.secrets.available()) {
      errors.awsSecretAccessKey =
        'Secure storage is unavailable on this machine, so credentials can’t be saved'
    }
    return errors
  }

  /** What Save would store: the typed key ID, with the typed secret or (when untouched) the saved one. */
  private nextAwsCredentials(input: SettingsInput): {
    next: AwsCredentials | null
    changed: boolean
    idMissing: boolean
    secretMissing: boolean
  } {
    const saved = this.awsCredentials()
    const accessKeyId = input.awsAccessKeyId.trim()
    const secretAccessKey = (input.awsSecretAccessKey ?? saved?.secretAccessKey ?? '').trim()
    const next = accessKeyId || secretAccessKey ? { accessKeyId, secretAccessKey } : null
    return {
      next,
      changed:
        next?.accessKeyId !== saved?.accessKeyId ||
        next?.secretAccessKey !== saved?.secretAccessKey,
      idMissing: !!next && !accessKeyId,
      secretMissing: !!next && !secretAccessKey
    }
  }

  save(input: SettingsInput): SaveResult {
    const errors = this.validate(input)
    if (Object.keys(errors).length > 0) return { ok: false, errors }

    const aws = this.nextAwsCredentials(input)
    if (input.googleClient) this.setGoogleClient(input.googleClient)
    this.db.transaction((tx) => {
      for (const row of this.sourceRows()) {
        const location =
          row.type === 'local' ? input.localFolder.trim() : input.googleDriveLocation.trim()
        tx.update(sources).set({ location }).where(eq(sources.id, row.id)).run()
      }
      tx.update(destinations)
        .set({
          location: input.awsLocation.trim(),
          storageClass: input.storageClass,
          // Clearing both fields removes the credentials.
          ...(aws.changed && {
            credentials: aws.next ? this.secrets.encrypt(JSON.stringify(aws.next)) : null
          })
        })
        .where(eq(destinations.configId, CONFIG_ID))
        .run()

      const first = tx
        .select()
        .from(folderNamingConventions)
        .where(eq(folderNamingConventions.configId, CONFIG_ID))
        .orderBy(folderNamingConventions.id)
        .get()
      const pattern = input.folderNamingPattern.trim()
      if (first) {
        tx.update(folderNamingConventions)
          .set({ pattern })
          .where(eq(folderNamingConventions.id, first.id))
          .run()
      } else {
        tx.insert(folderNamingConventions).values({ configId: CONFIG_ID, pattern }).run()
      }
    })
    return { ok: true }
  }

  setGoogleRefreshToken(token: string): void {
    this.setGoogleCredentials({ ...this.googleCredentials(), refreshToken: token })
  }

  getBackupConfig(): BackupConfig {
    const google = this.googleStatus()
    const dest = this.destinationRow()
    return {
      sources: this.sourceRows().map((row) => ({
        id: row.id,
        type: row.type,
        name: row.name,
        location: row.location,
        credentials: row.type === 'remote' ? this.googleCredentials().refreshToken : undefined,
        ...this.readiness(row, google)
      })),
      destination: {
        location: dest.location ? parseS3Location(dest.location) : null,
        credentials: this.awsCredentials(),
        storageClass: dest.storageClass
      },
      pattern: this.pattern(),
      identity: this.identity(),
      googleEnv: this.googleClient()
    }
  }
}

function isDirectory(p: string): boolean {
  return existsSync(p) && statSync(p).isDirectory()
}
