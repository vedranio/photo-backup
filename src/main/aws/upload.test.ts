import { describe, expect, it } from 'vitest'
import { describeUploadError } from './upload'

describe('describeUploadError', () => {
  it('explains that an existing backup wasn’t replaced', () => {
    const err = Object.assign(
      new Error('At least one of the pre-conditions you specified did not hold'),
      {
        name: 'PreconditionFailed',
        $metadata: { httpStatusCode: 412 }
      }
    )
    expect(
      (describeUploadError(err, 'bucket', 'photos/arnautovic-photos-2026-09-vedran.zip') as Error)
        .message
    ).toBe(
      'A backup named arnautovic-photos-2026-09-vedran.zip is already in s3://bucket/photos/, so it wasn’t replaced.'
    )
  })

  it('passes other errors through', () => {
    const err = new Error('Network down')
    expect(describeUploadError(err, 'bucket', 'k.zip')).toBe(err)
  })
})
