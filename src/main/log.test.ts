import { mkdtempSync, readFileSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFileLogger, describeError } from './log'

describe('createFileLogger', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'photobackup-log-'))
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('appends timestamped lines, creating the folder', () => {
    const file = join(dir, 'logs', 'main.log')
    const log = createFileLogger(file, { now: () => new Date('2026-11-01T00:00:00Z') })
    log.info('started')
    log.error('failed')
    expect(readFileSync(file, 'utf8')).toBe(
      '2026-11-01T00:00:00.000Z INFO  started\n2026-11-01T00:00:00.000Z ERROR failed\n'
    )
  })

  it('rotates to .1 when the file would grow past the limit', () => {
    const file = join(dir, 'main.log')
    const log = createFileLogger(file, { maxBytes: 100 })
    log.info('a'.repeat(50))
    log.info('b'.repeat(50))
    expect(readFileSync(`${file}.1`, 'utf8')).toContain('a'.repeat(50))
    expect(readFileSync(file, 'utf8')).not.toContain('a')
    log.info('c'.repeat(50))
    expect(readFileSync(`${file}.1`, 'utf8')).toContain('b'.repeat(50))
    expect(existsSync(`${file}.2`)).toBe(false)
  })
})

describe('describeError', () => {
  it('includes S3’s clock skew details and request ids', () => {
    const err = Object.assign(
      new Error('The difference between the request time and the current time is too large.'),
      {
        name: 'RequestTimeTooSkewed',
        $metadata: { httpStatusCode: 403, requestId: 'R1', extendedRequestId: 'X1', attempts: 3 },
        RequestTime: '20261031T201500Z',
        ServerTime: '2026-10-31T20:45:02Z',
        MaxAllowedSkewMilliseconds: '900000'
      }
    )
    expect(describeError(err)).toBe(
      'RequestTimeTooSkewed: The difference between the request time and the current time is too large. ' +
        '(status=403, attempts=3, requestId=R1, extendedRequestId=X1, RequestTime=20261031T201500Z, ' +
        'ServerTime=2026-10-31T20:45:02Z, MaxAllowedSkewMilliseconds=900000)'
    )
  })

  it('follows the cause', () => {
    const err = new Error('Upload failed', { cause: new TypeError('socket hang up') })
    expect(describeError(err)).toBe('Error: Upload failed; cause: TypeError: socket hang up')
  })

  it('handles non-errors', () => {
    expect(describeError('nope')).toBe('nope')
  })
})
