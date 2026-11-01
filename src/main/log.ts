// The app's log file: one timestamped line per entry, rotated to `<file>.1` when it grows too large.
// Knows nothing about Electron; index.ts points it at app.getPath('logs').
import { appendFileSync, mkdirSync, renameSync, statSync } from 'fs'
import { dirname } from 'path'

export type LogLevel = 'info' | 'warn' | 'error'

export interface Logger {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

const MAX_BYTES = 5 * 1024 * 1024

export function createFileLogger(
  file: string,
  { maxBytes = MAX_BYTES, now = () => new Date() }: { maxBytes?: number; now?: () => Date } = {}
): Logger {
  mkdirSync(dirname(file), { recursive: true })
  const write = (level: LogLevel, message: string): void => {
    const line = `${now().toISOString()} ${level.toUpperCase().padEnd(5)} ${message}\n`
    try {
      if (size(file) + line.length > maxBytes) renameSync(file, `${file}.1`)
      appendFileSync(file, line)
    } catch {
      // Logging must never break a backup.
    }
    if (level === 'error') console.error(message)
    else if (level === 'warn') console.warn(message)
    else console.log(message)
  }
  return {
    info: (m) => write('info', m),
    warn: (m) => write('warn', m),
    error: (m) => write('error', m)
  }
}

function size(file: string): number {
  try {
    return statSync(file).size
  } catch {
    return 0
  }
}

let current: Logger = {
  info: (m) => console.log(m),
  warn: (m) => console.warn(m),
  error: (m) => console.error(m)
}

/** The app's logger. Logs to the console until `setLogger` is called at startup. */
export const log: Logger = {
  info: (m) => current.info(m),
  warn: (m) => current.warn(m),
  error: (m) => current.error(m)
}

export function setLogger(logger: Logger): void {
  current = logger
}

/**
 * An error with everything useful for troubleshooting: AWS SDK errors carry the HTTP status, request ids
 * and, for S3, fields from the error response such as RequestTime and ServerTime.
 */
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const e = err as Error & Record<string, unknown>
  const meta = e.$metadata as
    | { httpStatusCode?: number; requestId?: string; extendedRequestId?: string; attempts?: number }
    | undefined
  const details: string[] = []
  if (meta?.httpStatusCode) details.push(`status=${meta.httpStatusCode}`)
  if (meta?.attempts) details.push(`attempts=${meta.attempts}`)
  if (meta?.requestId) details.push(`requestId=${meta.requestId}`)
  if (meta?.extendedRequestId) details.push(`extendedRequestId=${meta.extendedRequestId}`)
  for (const field of ['Code', 'RequestTime', 'ServerTime', 'MaxAllowedSkewMilliseconds']) {
    const value = e[field]
    if (typeof value === 'string' || typeof value === 'number') details.push(`${field}=${value}`)
  }
  const head = `${e.name}: ${e.message}${details.length ? ` (${details.join(', ')})` : ''}`
  return e.cause !== undefined ? `${head}; cause: ${describeError(e.cause)}` : head
}
