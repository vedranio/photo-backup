// Plausible data for the dev mock bridge and for `?state=` overrides.
import type { BackupSnapshot, ConfigView } from '@shared/api'
import { DEFAULT_PATTERN } from '@shared/pattern'
import { STATES, type StateId } from '../design'

export function placeholderConfig(googleReady: boolean): ConfigView {
  return {
    sources: [
      {
        id: 1,
        type: 'local',
        name: 'Local folder',
        location: '/Users/alex/Pictures',
        hasCredentials: false,
        configured: true
      },
      {
        id: 2,
        type: 'remote',
        name: 'Google Drive',
        location: googleReady ? 'https://drive.google.com/drive/folders/1Fam1lyPh0t0sAbCdEf' : '',
        ...(googleReady && { displayLocation: 'Photos' }),
        hasCredentials: googleReady,
        configured: googleReady,
        ...(!googleReady && { notConfiguredReason: 'Google Drive not configured' })
      }
    ],
    destination: {
      name: 'AWS S3',
      location: 'https://example-photos.s3.eu-west-2.amazonaws.com/backups',
      storageClass: 'DEEP_ARCHIVE',
      hasCredentials: true,
      // AWS's documented example key ID.
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKeyLength: 40
    },
    folderNamingPattern: DEFAULT_PATTERN,
    identity: { name: 'alex', surname: 'example' },
    google: googleReady
      ? { clientConfigured: true, missingEnv: [], signedIn: true, accountName: 'Alex Example' }
      : {
          clientConfigured: false,
          missingEnv: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'],
          signedIn: false
        }
  }
}

const idle: BackupSnapshot = { status: 'idle', stages: [], currentStage: null }

const running: BackupSnapshot = {
  status: 'running',
  month: '2026-09',
  stages: [
    { id: 'download', percent: 100 },
    { id: 'local', percent: 100 },
    { id: 'compress', percent: 100 },
    { id: 'upload', percent: 42 },
    { id: 'cleanup', percent: 0 }
  ],
  currentStage: 'upload'
}

export function placeholderSnapshot(state: StateId): BackupSnapshot {
  switch (state) {
    case STATES.homeInProgress:
    case STATES.confirmCancel:
      return running
    case STATES.homePaused:
      return {
        status: 'paused',
        month: '2026-09',
        stages: [
          { id: 'download', percent: 100 },
          { id: 'local', percent: 100 },
          { id: 'compress', percent: 63 },
          { id: 'upload', percent: 0 }
        ],
        currentStage: 'compress'
      }
    case STATES.homeFailed:
      return {
        status: 'failed',
        month: '2026-09',
        stages: [
          { id: 'download', percent: 100 },
          { id: 'local', percent: 100 },
          { id: 'compress', percent: 100 },
          { id: 'upload', percent: 37 }
        ],
        currentStage: 'upload',
        error:
          'Upload to AWS failed: The AWS Access Key Id you provided does not exist in our records.'
      }
    case STATES.homeSuccessful:
      return {
        status: 'succeeded',
        month: '2026-09',
        stages: [
          { id: 'download', percent: 100 },
          { id: 'local', percent: 100 },
          { id: 'compress', percent: 100 },
          { id: 'upload', percent: 100 }
        ],
        currentStage: null,
        result: {
          itemCount: 1284,
          totalBytes: 3_421_337_600,
          destination: 's3://example-photos/backups/example-photos-2026-10-alex.zip'
        }
      }
    default:
      return idle
  }
}
