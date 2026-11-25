import { describe, expect, it } from 'bun:test'
import { RedirectConfigError } from '#redirect/core/redirects/model/errors'
import {
  assertValidCollectionConfig,
  validateRedirectsCollectionConfig,
} from '#redirect/plugin/validate-config'

describe('validate-config', () => {
  it('accepts empty custom collection', () => {
    validateRedirectsCollectionConfig({ slug: 'redirects', fields: [] })
  })

  it('requires unique from when field is present', () => {
    expect(() =>
      validateRedirectsCollectionConfig({
        slug: 'redirects',
        fields: [{ name: 'from', type: 'text', unique: false, index: true }],
      })
    ).toThrow(RedirectConfigError)
  })

  it('rejects incompatible plugin-owned field types', () => {
    for (const [name, type] of [
      ['from', 'number'],
      ['to', 'textarea'],
      ['StatusCode', 'number'],
      ['enabled', 'text'],
      ['origin', 'text'],
    ] as const) {
      expect(() =>
        validateRedirectsCollectionConfig({
          slug: 'redirects',
          fields: [{ name, type } as never],
        })
      ).toThrow(`redirects collection field "${name}" must be type`)
    }
  })

  it('allows from with unique only (no separate index flag)', () => {
    expect(() =>
      validateRedirectsCollectionConfig({
        slug: 'redirects',
        fields: [{ name: 'from', type: 'text', unique: true }],
      })
    ).not.toThrow()
  })

  it('requires indexed enabled when field is present', () => {
    expect(() =>
      validateRedirectsCollectionConfig({
        slug: 'redirects',
        fields: [{ name: 'enabled', type: 'checkbox', index: false }],
      })
    ).toThrow(RedirectConfigError)
  })

  it('rejects invalid collection slugs and non-object configs', () => {
    expect(() => validateRedirectsCollectionConfig({ slug: '', fields: [] })).toThrow(
      'redirects collection must have a valid slug'
    )
    expect(() => assertValidCollectionConfig(null)).toThrow(
      'collection must be a CollectionConfig object'
    )
    const collection = { slug: 'redirects', fields: [] }
    expect(assertValidCollectionConfig(collection)).toBe(collection)
  })
})
