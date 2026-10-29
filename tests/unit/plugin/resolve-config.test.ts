import { describe, expect, it } from 'bun:test'
import type { CollectionConfig } from 'payload'
import { RedirectConfigError } from '#redirect/core/redirects/model/errors'
import { resolveRedirectsPluginConfig } from '#redirect/plugin/resolve-config'

const hostRedirectsCollection: CollectionConfig = { slug: 'redirects', fields: [] }

describe('resolve-config', () => {
  it('requires host collection', () => {
    expect(() => resolveRedirectsPluginConfig()).toThrow(RedirectConfigError)
    expect(() => resolveRedirectsPluginConfig()).toThrow(/requires `collection`/)
  })

  it('merges plugin fields when host fields is empty', () => {
    const resolved = resolveRedirectsPluginConfig({ collection: hostRedirectsCollection })
    expect(resolved.collection.fields?.map((f) => ('name' in f ? f.name : ''))).toEqual([
      'from',
      'to',
      'StatusCode',
      'enabled',
      'origin',
    ])
  })

  it('uses custom collection slug', () => {
    const resolved = resolveRedirectsPluginConfig({
      collection: { slug: 'my-redirects', fields: [] },
    })
    expect(resolved.collection.slug).toBe('my-redirects')
  })

  it('does not merge description — host may add editorial fields', () => {
    const resolved = resolveRedirectsPluginConfig({ collection: hostRedirectsCollection })
    const description = resolved.collection.fields?.find(
      (f) => 'name' in f && f.name === 'description'
    )
    expect(description).toBeUndefined()
  })
})
