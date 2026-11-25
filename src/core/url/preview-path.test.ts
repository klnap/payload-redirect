import { describe, expect, it } from 'bun:test'
import { localeCode } from './preview-path'

describe('localeCode', () => {
  it('reads string and object locale codes', () => {
    expect(localeCode('en')).toBe('en')
    expect(localeCode({ code: 'fr' })).toBe('fr')
    expect(localeCode({ code: '' })).toBeNull()
  })

  it('rejects empty and unsupported locale values', () => {
    expect(localeCode('')).toBeNull()
    expect(localeCode(null)).toBeNull()
    expect(localeCode(2)).toBeNull()
    expect(localeCode({ id: 'en' })).toBeNull()
  })
})
