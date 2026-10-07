export interface S3Location {
  bucket: string
  /** Undefined when the URL doesn't say; the client then follows S3's region redirects. */
  region?: string
  /** Key prefix with a trailing "/", or "" for the bucket root. */
  prefix: string
}

const normalisePrefix = (path: string): string => {
  const trimmed = decodeURIComponent(path).replace(/^\/+|\/+$/g, '')
  return trimmed ? `${trimmed}/` : ''
}

/**
 * Parses the Destination's AWS URL. Accepts:
 *   https://<bucket>.s3.<region>.amazonaws.com/<prefix>
 *   https://<bucket>.s3.amazonaws.com/<prefix>
 *   https://s3.<region>.amazonaws.com/<bucket>/<prefix>
 *   s3://<bucket>/<prefix>
 *   an S3 console link to the bucket: https://<region>.console.aws.amazon.com/s3/buckets/<bucket>?region=…&prefix=…
 */
export function parseS3Location(raw: string): S3Location | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol === 's3:') {
    return url.hostname ? { bucket: url.hostname, prefix: normalisePrefix(url.pathname) } : null
  }
  if (url.protocol !== 'https:') return null

  // The console's own region (in its hostname) isn't the bucket's; the `region` parameter is.
  if (/(^|\.)console\.aws\.amazon\.com$/.test(url.hostname)) {
    const bucket = url.pathname.match(/^\/s3\/buckets\/([^/]+)/)?.[1]
    if (!bucket) return null
    return {
      bucket: decodeURIComponent(bucket),
      region: url.searchParams.get('region') || undefined,
      prefix: normalisePrefix(url.searchParams.get('prefix') ?? '')
    }
  }

  const virtualHosted = url.hostname.match(/^(.+)\.s3(?:[.-]([a-z0-9-]+))?\.amazonaws\.com$/)
  if (virtualHosted) {
    const [, bucket, region] = virtualHosted
    return { bucket, region, prefix: normalisePrefix(url.pathname) }
  }
  const pathStyle = url.hostname.match(/^s3(?:[.-]([a-z0-9-]+))?\.amazonaws\.com$/)
  if (pathStyle) {
    const [bucket, ...rest] = url.pathname.split('/').filter(Boolean)
    if (!bucket) return null
    return { bucket, region: pathStyle[1], prefix: normalisePrefix(rest.join('/')) }
  }
  return null
}

export const s3Uri = (bucket: string, key: string): string => `s3://${bucket}/${key}`
