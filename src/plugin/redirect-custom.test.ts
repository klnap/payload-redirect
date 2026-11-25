import { describe, expect, it } from 'bun:test'
import type { Config } from 'payload'

import { redirects } from '#redirect/plugin/payload-plugin'
import { readRedirectCustom } from '#redirect/plugin/redirect-custom'

describe('readRedirectCustom', () => {
  it('reads identifier with default enabled', () => {
    expect(readRedirectCustom({ redirect: { identifier: 'slug' } })).toEqual({
      enabled: true,
      identifier: 'slug',
    })
  })

  it('returns null when enabled false', () => {
    expect(readRedirectCustom({ redirect: { enabled: false, identifier: 'slug' } })).toBeNull()
  })

  it('returns null without identifier', () => {
    expect(readRedirectCustom({ redirect: { enabled: true } })).toBeNull()
  })
})

describe('redirects plugin custom.redirect wiring', () => {
  it('appends afterChange only when custom.redirect is set', () => {
    const plugin = redirects({ collection: { slug: 'redirects', fields: [] } })
    const existingHook = () => undefined
    const config = plugin({
      collections: [
        {
          slug: 'articles',
          fields: [],
          hooks: { afterChange: existingHook },
          custom: { redirect: { identifier: 'slug' } },
        },
        { slug: 'other', fields: [] },
      ],
    } as unknown as Config) as Config

    expect(config.collections?.[0]?.hooks?.afterChange).toHaveLength(2)
    expect(config.collections?.[0]?.hooks?.afterChange?.[0]).toBe(existingHook)
    expect(config.collections?.[1]?.hooks?.afterChange).toBeUndefined()
  })
})
