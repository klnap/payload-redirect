import { describe, expect, it } from 'bun:test'
import type { Config, Plugin } from 'payload'

import { redirects } from '#redirect/plugin/payload-plugin'

describe('redirects plugin config transform', () => {
  it('replaces host redirects stub with merged collection (fields: [])', () => {
    const host = { slug: 'redirects', fields: [] }
    const plugin = redirects({ collection: host })
    const config = plugin({
      collections: [host, { slug: 'pages', fields: [] }],
    } as unknown as Config) as Config

    const redirectsCol = config.collections?.find((c) => c.slug === 'redirects')
    expect(redirectsCol?.fields?.map((f) => ('name' in f ? f.name : ''))).toEqual([
      'from',
      'to',
      'StatusCode',
      'enabled',
      'origin',
    ])

    const from = redirectsCol?.fields?.find((f) => 'name' in f && f.name === 'from')
    expect(from && 'unique' in from ? from.unique : undefined).toBe(true)
  })

  it('preserves changes made to the redirects collection by an earlier plugin', async () => {
    const host = { slug: 'redirects', fields: [] }
    const beforeChange = () => undefined
    const plugin = redirects({ collection: host })
    const unrelatedPlugin: Plugin = (incoming) => ({
      ...incoming,
      collections: (incoming.collections ?? []).map((collection) =>
        collection.slug === 'redirects'
          ? {
              ...collection,
              admin: { description: 'added by another plugin' },
              hooks: { ...collection.hooks, beforeChange: [beforeChange] },
            }
          : collection
      ),
    })
    const earlierPluginConfig = await unrelatedPlugin({
      collections: [host],
    } as unknown as Config)

    const config = await plugin(earlierPluginConfig)
    const collection = config.collections?.find((entry) => entry.slug === 'redirects')

    expect(collection?.admin?.description).toBe('added by another plugin')
    expect(collection?.hooks?.beforeChange).toContain(beforeChange)
    expect(collection?.fields?.some((field) => 'name' in field && field.name === 'from')).toBe(true)
  })

  it('rejects a host value in the reserved runtime namespace and duplicate installation', () => {
    const host = { slug: 'redirects', fields: [] }
    const plugin = redirects({ collection: host })
    const once = plugin({ collections: [host] } as unknown as Config) as Config

    expect(() => plugin(once)).toThrow('duplicate plugin installation')
    expect(() =>
      plugin({
        collections: [host],
        custom: { payloadRedirect: { hostValue: true } },
      } as unknown as Config)
    ).toThrow('config.custom.payloadRedirect is reserved')
  })
})
