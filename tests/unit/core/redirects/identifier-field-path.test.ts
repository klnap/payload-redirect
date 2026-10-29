import { describe, expect, it } from 'bun:test'

import {
  isIdentifierPathLocalized,
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
})
