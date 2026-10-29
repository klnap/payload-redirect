import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { resolveRedirect } from '@klnap/payload-redirect'
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

  it('uses custom slug in runtime and resolver', async () => {
    const custom = handle.payload.config.custom as { payloadRedirect?: { collectionSlug: string } }
    expect(custom.payloadRedirect?.collectionSlug).toBe('url-rules')

    await createManualRedirect(handle.payload, { from: '/custom', to: '/dest' }, 'url-rules')
    expect(await resolveRedirect({ payload: handle.payload, from: '/custom' })).toEqual({
      statusCode: 301,
      to: '/dest',
    })
  })
})
