// The typed contract between the renderer and the main process.
// The preload script implements it over IPC (window.api); the renderer's dev-only mock implements it in-browser.

export type SourceType = 'local' | 'remote'

export interface SourceView {
  id: number
  type: SourceType
  name: string
  location: string
  /** Credentials are never sent to the renderer; only whether they exist. */
  hasCredentials: boolean
  /** A friendlier name for `location` when one is known, e.g. a Drive folder's name. */
  displayLocation?: string
  /** Ready to back up from. When false, `notConfiguredReason` says why. */
  configured: boolean
  notConfiguredReason?: string
}

export interface DestinationView {
  name: string
  location: string
  storageClass: string
  hasCredentials: boolean
  /** The access key ID is an identifier, not a secret, so it's shown. '' when none is saved. */
  accessKeyId: string
  /** Only the secret's length (for masking), never the secret. 0 when none is saved. */
  secretAccessKeyLength: number
}

export interface GoogleClient {
  clientId: string
  clientSecret: string
}

export interface GoogleStatus {
  /** An OAuth client ID and secret are set: entered in Settings, or in the environment. */
  clientConfigured: boolean
  /** Environment variables that still need setting. */
  missingEnv: string[]
  signedIn: boolean
  /** The signed-in Google account's name, when it could be looked up. */
  accountName?: string
}

export interface Identity {
  name: string
  surname: string
}

export interface ConfigView {
  sources: SourceView[]
  destination: DestinationView
  folderNamingPattern: string
  identity: Identity
  google: GoogleStatus
}

export interface AwsCredentials {
  accessKeyId: string
  secretAccessKey: string
}

export interface SettingsInput {
  googleDriveLocation: string
  awsLocation: string
  localFolder: string
  folderNamingPattern: string
  /** One of STORAGE_CLASSES (src/shared/storageClass.ts). */
  storageClass: string
  awsAccessKeyId: string
  /** Omit to keep the saved secret. */
  awsSecretAccessKey?: string
  /** The Google OAuth client, entered the first time. Omit to keep the saved one. */
  googleClient?: GoogleClient
}

export type SettingsField = keyof SettingsInput

export type SaveResult =
  { ok: true } | { ok: false; errors: Partial<Record<SettingsField, string>> }

export type SignInResult = { ok: true } | { ok: false; error: string }

export type StageId = 'download' | 'local' | 'compress' | 'upload' | 'cleanup'

export const STAGE_LABELS: Record<StageId, string> = {
  download: 'Downloading from Google',
  local: 'Getting local files',
  compress: 'Compressing',
  upload: 'Uploading to AWS',
  cleanup: 'Cleaning up'
}

export interface StageProgress {
  id: StageId
  /** 0–100 */
  percent: number
}

export type JobStatus = 'idle' | 'running' | 'paused' | 'succeeded' | 'failed'

export interface BackupRequest {
  sourceIds: number[]
  cleanUp: boolean
  /** The month being backed up, "YYYY-MM". Fills {yyyy} and {MM} in the name. */
  month: string
}

export interface BackupResult {
  itemCount: number
  totalBytes: number
  /** Where the archive went, e.g. s3://bucket/prefix/arnautovic-photos-2026-10-vedran/… */
  destination: string
}

export interface BackupSnapshot {
  status: JobStatus
  /** The stages this run goes through, in order. Empty when idle. */
  stages: StageProgress[]
  currentStage: StageId | null
  result?: BackupResult
  error?: string
  /** The run's backup month, "YYYY-MM". Absent when idle. */
  month?: string
}

export interface Api {
  config: {
    get(): Promise<ConfigView>
    save(input: SettingsInput): Promise<SaveResult>
    chooseLocalFolder(): Promise<string | null>
  }
  google: {
    /** Signs in to Google, first saving `client` when given (the first-time setup). */
    signIn(client?: GoogleClient): Promise<SignInResult>
  }
  backup: {
    getStatus(): Promise<BackupSnapshot>
    start(request: BackupRequest): Promise<BackupSnapshot>
    pause(): Promise<BackupSnapshot>
    resume(): Promise<BackupSnapshot>
    retry(): Promise<BackupSnapshot>
    cancel(): Promise<BackupSnapshot>
    /** Back to idle after a successful backup ("Done"). */
    dismiss(): Promise<BackupSnapshot>
    onUpdate(listener: (snapshot: BackupSnapshot) => void): () => void
  }
}
