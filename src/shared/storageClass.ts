// S3 storage classes that apply to a normal (general purpose) bucket, in the S3 console's order.
// Excluded: Reduced Redundancy (deprecated), Express One Zone (directory buckets), Outposts and Snow.
export const STORAGE_CLASSES = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'INTELLIGENT_TIERING', label: 'Intelligent-Tiering' },
  { value: 'STANDARD_IA', label: 'Standard-IA' },
  { value: 'ONEZONE_IA', label: 'One Zone-IA' },
  { value: 'GLACIER_IR', label: 'Glacier Instant Retrieval' },
  { value: 'GLACIER', label: 'Glacier Flexible Retrieval' },
  { value: 'DEEP_ARCHIVE', label: 'Glacier Deep Archive' }
] as const

export type StorageClass = (typeof STORAGE_CLASSES)[number]['value']

export const DEFAULT_STORAGE_CLASS: StorageClass = 'DEEP_ARCHIVE'

export const isStorageClass = (value: string): value is StorageClass =>
  STORAGE_CLASSES.some((c) => c.value === value)
