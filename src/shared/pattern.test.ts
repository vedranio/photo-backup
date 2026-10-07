import { describe, expect, it } from 'vitest'
import { identityFromFullName, resolvePattern, slugify, validatePattern } from './pattern'

const oct7 = new Date(2026, 9, 7, 9, 5)

describe('validatePattern', () => {
  it('accepts tokens and safe literals', () => {
    expect(validatePattern('{surname}-photos-{yyyy}-{MM}-{name}')).toBeNull()
    expect(validatePattern('backup_{yyyy}.{MM}')).toBeNull()
  })
  it('rejects unknown tokens, stray braces, unsafe characters and blanks', () => {
    expect(validatePattern('{year}')).toMatch(/Unknown token \{year\}/)
    expect(validatePattern('photos-{yyyy}-{MM}-{dd}')).toMatch(/Unknown token \{dd\}/)
    expect(validatePattern('photos-{yyyy')).toMatch(/Unmatched/)
    expect(validatePattern('photos/{yyyy}')).toMatch(/Use only/)
    expect(validatePattern('  ')).toBe('Enter a pattern')
  })
})

describe('resolvePattern', () => {
  it('fills in date and identity tokens', () => {
    expect(
      resolvePattern('{surname}-photos-{yyyy}-{MM}-{name}', oct7, {
        name: 'vedran',
        surname: 'arnautovic'
      })
    ).toBe('arnautovic-photos-2026-10-vedran')
    expect(resolvePattern('{yyyy}{MM}', oct7, { name: '', surname: '' })).toBe('202610')
  })
  it('collapses the hyphens an empty token leaves behind', () => {
    expect(
      resolvePattern('{surname}-photos-{yyyy}-{MM}-{name}', oct7, { name: 'vedran', surname: '' })
    ).toBe('photos-2026-10-vedran')
  })
})

describe('identity', () => {
  it('slugifies accents and punctuation', () => {
    expect(slugify('Arnautović')).toBe('arnautovic')
    expect(slugify("O'Brien-Smith")).toBe('o-brien-smith')
  })
  it('splits first and last word', () => {
    expect(identityFromFullName('Vedran Arnautovic', 'vedran')).toEqual({
      name: 'vedran',
      surname: 'arnautovic'
    })
    expect(identityFromFullName('Ana de la Cruz', 'ana')).toEqual({ name: 'ana', surname: 'cruz' })
    expect(identityFromFullName('Cher', 'cher')).toEqual({ name: 'cher', surname: '' })
    expect(identityFromFullName('', 'vedran')).toEqual({ name: 'vedran', surname: '' })
  })
})
