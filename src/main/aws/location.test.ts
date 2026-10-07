import { describe, expect, it } from 'vitest'
import { parseS3Location } from './location'
import { parseDriveFolderId } from '../google/location'

describe('parseS3Location', () => {
  it.each([
    [
      'https://my-bucket.s3.eu-west-2.amazonaws.com/photos',
      { bucket: 'my-bucket', region: 'eu-west-2', prefix: 'photos/' }
    ],
    ['https://my.bucket.s3.amazonaws.com/', { bucket: 'my.bucket', region: undefined, prefix: '' }],
    [
      'https://s3.us-west-2.amazonaws.com/my-bucket/a/b/',
      { bucket: 'my-bucket', region: 'us-west-2', prefix: 'a/b/' }
    ],
    ['s3://my-bucket/photos/family', { bucket: 'my-bucket', prefix: 'photos/family/' }],
    [
      'https://us-east-1.console.aws.amazon.com/s3/buckets/arnautovic-photos?region=eu-west-2&bucketType=general&tab=objects',
      { bucket: 'arnautovic-photos', region: 'eu-west-2', prefix: '' }
    ],
    [
      'https://s3.console.aws.amazon.com/s3/buckets/arnautovic-photos?region=ap-southeast-2&prefix=backups/2026/&showversions=false',
      { bucket: 'arnautovic-photos', region: 'ap-southeast-2', prefix: 'backups/2026/' }
    ],
    [
      'https://console.aws.amazon.com/s3/buckets/arnautovic-photos',
      { bucket: 'arnautovic-photos', region: undefined, prefix: '' }
    ]
  ])('parses %s', (url, expected) => {
    expect(parseS3Location(url)).toEqual(expected)
  })
  it.each([
    '',
    'not a url',
    'https://example.com/bucket',
    'https://s3.amazonaws.com/',
    'https://us-east-1.console.aws.amazon.com/s3/home?region=us-east-1'
  ])('rejects %j', (url) => {
    expect(parseS3Location(url)).toBeNull()
  })
})

describe('parseDriveFolderId', () => {
  it('accepts folder URLs and bare IDs', () => {
    expect(parseDriveFolderId('https://drive.google.com/drive/folders/1AbCdEfGhIjKlMn')).toBe(
      '1AbCdEfGhIjKlMn'
    )
    expect(
      parseDriveFolderId('https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlMn?usp=sharing')
    ).toBe('1AbCdEfGhIjKlMn')
    expect(parseDriveFolderId('1AbCdEfGhIjKlMn')).toBe('1AbCdEfGhIjKlMn')
  })
  it('rejects other URLs and text', () => {
    expect(parseDriveFolderId('https://example.com/folders/1AbCdEfGhIjKlMn')).toBeNull()
    expect(parseDriveFolderId('My Photos')).toBeNull()
  })
})
