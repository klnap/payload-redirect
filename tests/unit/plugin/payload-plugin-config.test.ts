import { describe, expect, it } from 'bun:test'
import type { Config } from 'payload'

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
})
