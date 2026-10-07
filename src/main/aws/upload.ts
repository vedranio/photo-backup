import { createReadStream } from 'fs'
import { S3Client, type StorageClass } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import type { AwsCredentials } from '@shared/api'
import type { S3Location } from './location'

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
    upload.on('httpUploadProgress', ({ loaded, total }) => {
      if (loaded !== undefined && total) params.onProgress(loaded / total)
    })
    const abort = (): void => void upload.abort()
    params.signal.addEventListener('abort', abort, { once: true })
    try {
      await upload.done()
    } catch (err) {
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
