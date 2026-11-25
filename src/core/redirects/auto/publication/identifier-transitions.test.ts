import { describe, expect, it } from 'bun:test'
import {
  collectLocalizedIdentifierTransitions,
  collectScalarIdentifierTransition,
  identifierValueToString,
} from '#redirect/core/redirects/auto/publication/identifier-transitions'

describe('identifier transitions', () => {
  it('coerces supported identifier values and rejects empty or complex values', () => {
    expect(identifierValueToString(0)).toBe('0')
    expect(identifierValueToString(false)).toBe('false')
    expect(identifierValueToString('  value  ')).toBe('value')
    expect(identifierValueToString(' ')).toBeUndefined()
    expect(identifierValueToString(null)).toBeUndefined()
    expect(identifierValueToString({})).toBeUndefined()
  })

  it('scalar unchanged returns undefined', () => {
    expect(collectScalarIdentifierTransition({ previous: '/a', current: '/a' })).toBeUndefined()
  })

  it('scalar changed returns transition', () => {
    expect(collectScalarIdentifierTransition({ previous: '/a', current: '/b' })).toEqual({
      previous: '/a',
      current: '/b',
    })
  })

  it('missing previous or current skipped', () => {
    expect(collectScalarIdentifierTransition({ current: '/b' })).toBeUndefined()
  })

  it('localized partial changes only', () => {
    const transitions = collectLocalizedIdentifierTransitions({
      locales: ['pl', 'en', 'de'],
      previousByLocale: { pl: '/stary', en: '/old', de: '/alt' },
      currentByLocale: { pl: '/nowy', en: '/old', de: '/neu' },
    })
    expect(transitions).toEqual([
      { locale: 'pl', previous: '/stary', current: '/nowy' },
      { locale: 'de', previous: '/alt', current: '/neu' },
    ])
  })
})
