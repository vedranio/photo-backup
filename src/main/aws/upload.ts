import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { S3Client, type StorageClass } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import type { AwsCredentials } from '@shared/api'
import type { S3Location } from './location'
import { describeError, log } from '../log'

export interface UploadParams {
  location: S3Location
  credentials: AwsCredentials
  storageClass: string
  key: string
  file: string
  signal: AbortSignal
  onProgress(fraction: number): void
}

/** Multipart upload of one file. Rejects with an AbortError when `signal` aborts. */
export async function uploadFile(params: UploadParams): Promise<void> {
  const target = `s3://${params.location.bucket}/${params.key}`
  const { size } = await stat(params.file)
  const started = Date.now()
  const elapsed = (): string => `${((Date.now() - started) / 1000).toFixed(1)}s`
  log.info(`Upload started: ${target}, ${size} bytes, storage class ${params.storageClass}`)
  const client = new S3Client({
    region: params.location.region ?? 'us-east-1',
    followRegionRedirects: true,
    credentials: params.credentials
  })
  try {
    const upload = new Upload({
      client,
      params: {
        Bucket: params.location.bucket,
        Key: params.key,
        Body: createReadStream(params.file),
        StorageClass: params.storageClass as StorageClass,
        // Never replace an earlier backup with the same name: S3 rejects the write if the key exists.
        IfNoneMatch: '*'
      }
    })
    // Logged every 10%, so a stall (e.g. the Mac sleeping) shows up as a gap.
    let loggedTenths = 0
    upload.on('httpUploadProgress', ({ loaded, total }) => {
      if (loaded === undefined || !total) return
      params.onProgress(loaded / total)
      const tenths = Math.floor((loaded / total) * 10)
      if (tenths > loggedTenths && tenths < 10) {
        loggedTenths = tenths
        log.info(`Upload ${tenths * 10}%: ${loaded} of ${total} bytes after ${elapsed()}`)
      }
    })
    const abort = (): void => void upload.abort()
    params.signal.addEventListener('abort', abort, { once: true })
    try {
      await upload.done()
      log.info(`Upload finished: ${target} after ${elapsed()}`)
    } catch (err) {
      if (params.signal.aborted) log.info(`Upload stopped (paused or cancelled) after ${elapsed()}`)
      else log.error(`Upload failed after ${elapsed()}: ${target}: ${describeError(err)}`)
      throw describeUploadError(err, params.location.bucket, params.key)
    } finally {
      params.signal.removeEventListener('abort', abort)
    }
  } finally {
    client.destroy()
  }
}

/** Turns S3's "already exists" rejection into a message the user can act on. */
export function describeUploadError(err: unknown, bucket: string, key: string): unknown {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } }
  const status = e?.$metadata?.httpStatusCode
  if (e?.name === 'PreconditionFailed' || status === 412) {
    return new Error(
      `A backup named ${key.split('/').pop()} is already in s3://${bucket}/${key.slice(0, key.lastIndexOf('/') + 1)}, so it wasn’t replaced.`
    )
  }
  if (e?.name === 'ConditionalRequestConflict' || status === 409) {
    return new Error('Another upload to the same name was in progress. Try again.')
  }
  return err
}
