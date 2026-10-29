import { describe, expect, it } from 'bun:test'
import { RedirectConfigError } from '#redirect/core/redirects/model/errors'
import { validateRedirectsCollectionConfig } from '#redirect/plugin/validate-config'

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
})
