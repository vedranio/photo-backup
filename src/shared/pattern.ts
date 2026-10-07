// Folder naming convention patterns: literal text plus {tokens}, e.g. "{surname}-photos-{yyyy}-{MM}-{name}".
import type { Identity } from './api'

// {yyyy} and {MM} come from the backup month the user picks.
export const PATTERN_TOKENS = ['yyyy', 'MM', 'name', 'surname'] as const

export const DEFAULT_PATTERN = '{surname}-photos-{yyyy}-{MM}-{name}'

const TOKEN_RE = /\{([^{}]*)\}/g
// Characters that are safe in an S3 key segment without escaping.
const LITERAL_RE = /^[A-Za-z0-9._-]*$/

/** Returns an error message, or null when the pattern is valid. */
export function validatePattern(pattern: string): string | null {
  if (!pattern.trim()) return 'Enter a pattern'
  for (const [, token] of pattern.matchAll(TOKEN_RE)) {
    if (!(PATTERN_TOKENS as readonly string[]).includes(token)) {
      return `Unknown token {${token}}. Use ${PATTERN_TOKENS.map((t) => `{${t}}`).join(', ')}`
    }
  }
  const literal = pattern.replace(TOKEN_RE, '')
  if (/[{}]/.test(literal)) return 'Unmatched { or }'
  if (!LITERAL_RE.test(literal))
    return 'Use only letters, digits, ".", "_" and "-" outside {tokens}'
  return null
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** Resolves a valid pattern to a folder name. Empty tokens leave no doubled or dangling hyphens. */
export function resolvePattern(pattern: string, month: Date, identity: Identity): string {
  const values: Record<string, string> = {
    yyyy: String(month.getFullYear()),
    MM: pad(month.getMonth() + 1),
    name: identity.name,
    surname: identity.surname
  }
  return pattern
    .replace(TOKEN_RE, (_, token: string) => values[token] ?? '')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
}

/** Lower-cases, strips accents and turns anything else into hyphens: "Arnautović" → "arnautovic". */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** First word → name, last word → surname. A single word is just the name. */
export function identityFromFullName(fullName: string, fallbackName: string): Identity {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { name: slugify(fallbackName), surname: '' }
  if (words.length === 1) return { name: slugify(words[0]), surname: '' }
  return { name: slugify(words[0]), surname: slugify(words[words.length - 1]) }
}
