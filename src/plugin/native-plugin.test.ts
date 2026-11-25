import { describe, expect, it } from 'bun:test'
import { redirects } from '@klnap/payload-redirect'
import type { Config } from 'payload'

describe('redirects plugin registration', () => {
  it('registers its own collection with no configuration', async () => {
    const plugin = redirects()
    const config = await plugin({ collections: [] } as unknown as Config)

    const collection = config.collections?.find(({ slug }) => slug === 'redirects')

    expect(collection).toBeDefined()
    expect(collection?.fields.map((field) => ('name' in field ? field.name : undefined))).toEqual([
      'from',
      'to',
      'statusCode',
      'enabled',
      'origin',
    ])
  })
})
