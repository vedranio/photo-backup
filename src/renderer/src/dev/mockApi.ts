// Dev only: an in-browser stand-in for the preload bridge, so the renderer runs in a plain browser
// (modelwright's preview). Simulates a backup job with timers. Never bundled into production.
import type { Api, BackupSnapshot, ConfigView, StageId } from '@shared/api'
import { resolvePattern, validatePattern } from '@shared/pattern'
import { parseMonth } from '@shared/month'

const TICK_MS = 150
const STEP = 4

export function createMockApi(seed: { config: ConfigView; snapshot: BackupSnapshot }): Api {
  let config = structuredClone(seed.config)
  let snap = structuredClone(seed.snapshot)
  let timer: ReturnType<typeof setInterval> | undefined
  const listeners = new Set<(s: BackupSnapshot) => void>()

  const emit = (): BackupSnapshot => {
    const copy = structuredClone(snap)
    listeners.forEach((l) => l(copy))
    return copy
  }

  // Names the simulated zip like the real planner does.
  let destination = `s3://example-photos/backups/${resolvePattern(seed.config.folderNamingPattern, new Date(2026, 8, 1), seed.config.identity)}.zip`

  const tick = (): void => {
    if (snap.status !== 'running') return
    const stage = snap.stages.find((s) => s.percent < 100)
    if (!stage) {
      stop()
      snap = {
        status: 'succeeded',
        month: snap.month,
        stages: snap.stages,
        currentStage: null,
        result: {
          itemCount: 1284,
          totalBytes: 3_421_337_600,
          destination
        }
      }
    } else {
      stage.percent = Math.min(100, stage.percent + STEP)
      snap.currentStage = stage.id
    }
    emit()
  }

  const run = (): void => {
    stop()
    timer = setInterval(tick, TICK_MS)
  }
  const stop = (): void => {
    if (timer) clearInterval(timer)
    timer = undefined
  }

  // A seeded running or paused job keeps going, so the preview behaves like the app.
  if (snap.status === 'running' || snap.status === 'paused') run()

  const delay = <T>(value: T): Promise<T> => new Promise((r) => setTimeout(() => r(value), 50))

  return {
    config: {
      get: () => delay(structuredClone(config)),
      async save(input) {
        const patternError = validatePattern(input.folderNamingPattern)
        if (patternError) return { ok: false, errors: { folderNamingPattern: patternError } }
        config = {
          ...config,
          ...(input.googleClient && {
            google: { ...config.google, clientConfigured: true, missingEnv: [] }
          }),
          sources: config.sources.map((s) => ({
            ...s,
            location: s.type === 'local' ? input.localFolder : input.googleDriveLocation
          })),
          destination: {
            ...config.destination,
            location: input.awsLocation,
            storageClass: input.storageClass,
            hasCredentials: !!input.awsAccessKeyId,
            accessKeyId: input.awsAccessKeyId,
            secretAccessKeyLength:
              input.awsSecretAccessKey?.length ?? config.destination.secretAccessKeyLength
          },
          folderNamingPattern: input.folderNamingPattern
        }
        return delay({ ok: true as const })
      },
      chooseLocalFolder: () => delay('/Users/alex/Pictures/Holidays')
    },
    google: {
      async signIn(client) {
        if (client && !/\.apps\.googleusercontent\.com$/.test(client.clientId)) {
          return { ok: false, error: 'The client ID ends in .apps.googleusercontent.com' }
        }
        if (!config.google.clientConfigured && !client) {
          return { ok: false, error: 'Enter the Google OAuth client ID and secret first' }
        }
        config = {
          ...config,
          google: {
            clientConfigured: true,
            missingEnv: [],
            signedIn: true,
            accountName: 'Alex Example'
          },
          sources: config.sources.map((s) =>
            s.type === 'remote'
              ? {
                  ...s,
                  hasCredentials: true,
                  configured: !!s.location,
                  notConfiguredReason: s.location ? undefined : 'No Google Drive location set'
                }
              : s
          )
        }
        return delay({ ok: true as const })
      }
    },
    backup: {
      getStatus: () => delay(structuredClone(snap)),
      async start(req) {
        if (snap.status === 'running' || snap.status === 'paused') return emit()
        const remote = config.sources.find(
          (s) => s.type === 'remote' && req.sourceIds.includes(s.id)
        )
        const local = config.sources.find((s) => s.type === 'local' && req.sourceIds.includes(s.id))
        const ids: StageId[] = [
          ...(remote ? ['download' as const] : []),
          ...(local ? ['local' as const] : []),
          'compress',
          'upload',
          ...(req.cleanUp ? ['cleanup' as const] : [])
        ]
        const month = parseMonth(req.month) ?? new Date()
        destination = `s3://example-photos/backups/${resolvePattern(config.folderNamingPattern, month, config.identity)}.zip`
        snap = {
          status: 'running',
          stages: ids.map((id) => ({ id, percent: 0 })),
          currentStage: ids[0],
          month: req.month
        }
        run()
        return emit()
      },
      async pause() {
        if (snap.status === 'running') snap = { ...snap, status: 'paused' }
        return emit()
      },
      async resume() {
        if (snap.status === 'paused') snap = { ...snap, status: 'running' }
        run()
        return emit()
      },
      async retry() {
        if (snap.status === 'failed') {
          snap = { ...snap, status: 'running', error: undefined }
          run()
        }
        return emit()
      },
      async cancel() {
        stop()
        snap = { status: 'idle', stages: [], currentStage: null }
        return emit()
      },
      async dismiss() {
        if (snap.status === 'succeeded') snap = { status: 'idle', stages: [], currentStage: null }
        return emit()
      },
      onUpdate(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      }
    }
  }
}
