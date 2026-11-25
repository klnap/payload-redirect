import { describe, expect, it } from 'bun:test'

import {
  isIdentifierPathLocalized,
  paramKeyFromIdentifierPath,
  readIdentifierAtPath,
} from '#redirect/core/redirects/identifier-field-path'

describe('readIdentifierAtPath', () => {
  it('reads top-level localized slug', () => {
    expect(readIdentifierAtPath({ slug: { en: 'tower', pl: 'wieza' } }, 'slug', 'pl', true)).toBe(
      'wieza'
    )
  })

  it('reads nested localized field', () => {
    expect(
      readIdentifierAtPath({ seo: { slug: { en: 'a', pl: 'b' } } }, 'seo.slug', 'pl', true)
    ).toBe('b')
  })

  it('reads scalar values and rejects missing, empty, and non-object paths', () => {
    expect(readIdentifierAtPath({ id: 0 }, 'id', 'en', false)).toBe('0')
    expect(readIdentifierAtPath({ active: false }, 'active', 'en', false)).toBe('false')
    expect(readIdentifierAtPath({ slug: 'plain' }, 'slug', 'en', true)).toBe('plain')
    expect(readIdentifierAtPath({ slug: { en: '  ' } }, 'slug', 'en', true)).toBeUndefined()
    expect(readIdentifierAtPath({ slug: ['bad'] }, 'slug', 'en', true)).toBeUndefined()
    expect(readIdentifierAtPath({}, 'slug', 'en', false)).toBeUndefined()
    expect(readIdentifierAtPath({ slug: 'x' }, '', 'en', true)).toBeUndefined()
    expect(readIdentifierAtPath({ slug: null }, 'slug.value', 'en', false)).toBeUndefined()
  })
})

describe('isIdentifierPathLocalized', () => {
  it('detects localized leaf in group', () => {
    expect(
      isIdentifierPathLocalized(
        [
          {
            type: 'group',
            name: 'seo',
            fields: [{ name: 'slug', type: 'text', localized: true }],
          },
        ],
        'seo.slug'
      )
    ).toBe(true)
  })

  it('flattens tab and row containers and rejects missing paths', () => {
    const fields = [
      {
        type: 'tabs',
        tabs: [
          {
            fields: [
              {
                name: 'seo',
                type: 'group',
                fields: [{ name: 'slug', localized: true }],
              },
              { type: 'row', fields: [{ name: 'flat', localized: true }] },
            ],
          },
        ],
      },
    ]
    expect(isIdentifierPathLocalized(fields, 'seo.slug')).toBe(true)
    expect(isIdentifierPathLocalized(fields, 'flat')).toBe(true)
    expect(isIdentifierPathLocalized(fields, 'missing')).toBe(false)
    expect(isIdentifierPathLocalized(fields, '')).toBe(false)
    expect(isIdentifierPathLocalized([{ name: 'seo' }], 'seo.slug')).toBe(false)
  })
})

describe('paramKeyFromIdentifierPath', () => {
  it('uses the last non-empty segment or the original path', () => {
    expect(paramKeyFromIdentifierPath('seo.slug')).toBe('slug')
    expect(paramKeyFromIdentifierPath('')).toBe('')
    expect(paramKeyFromIdentifierPath('..')).toBe('..')
  })
})
