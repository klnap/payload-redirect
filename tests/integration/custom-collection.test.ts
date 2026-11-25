import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { createManualRedirect } from '../helpers/factories/redirect'
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from '../helpers/payload-harness'

describe.skipIf(!intDatabaseConfigured)('custom redirects collection', () => {
  let handle: RedirectIntHandle

  beforeAll(async () => {
    handle = await createRedirectIntPayload({
      pluginCollection: {
        slug: 'url-rules',
        fields: [],
        labels: { singular: 'URL rule', plural: 'URL rules' },
      },
    })
  }, 120_000)

  afterAll(async () => {
    await handle.destroy()
  })

  it('uses the configured slug for the plugin-owned collection', async () => {
    const custom = handle.payload.config.custom as { payloadRedirect?: { collectionSlug: string } }
    expect(custom.payloadRedirect?.collectionSlug).toBe('url-rules')

    await createManualRedirect(handle.payload, { from: '/custom', to: '/dest' }, 'url-rules')
    const result = await handle.payload.find({
      collection: 'url-rules',
      where: { from: { equals: '/custom' } },
      limit: 1,
      pagination: false,
      overrideAccess: true,
    })
    expect(result.docs[0]).toMatchObject({ from: '/custom', to: '/dest', StatusCode: '301' })
  })
})
