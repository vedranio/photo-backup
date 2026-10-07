/**
 * Parses the Google Drive Source's location to a folder ID. Accepts a folder URL
 * (https://drive.google.com/drive/folders/<id>, also with /u/<n>/) or a bare folder ID.
 */
export function parseDriveFolderId(raw: string): string | null {
  const value = raw.trim()
  if (/^[A-Za-z0-9_-]{10,}$/.test(value)) return value
  try {
    const url = new URL(value)
    if (url.hostname !== 'drive.google.com') return null
    const match = url.pathname.match(/\/folders\/([A-Za-z0-9_-]+)/)
    return match ? match[1] : (url.searchParams.get('id') ?? null)
  } catch {
    return null
  }
}
