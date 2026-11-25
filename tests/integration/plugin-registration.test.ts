import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { versionedArticlesCollection } from '../helpers/factories/versioned-document'
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from '../helpers/payload-harness'

describe.skipIf(!intDatabaseConfigured)('plugin registration', () => {
  let handle: RedirectIntHandle

  beforeAll(async () => {
    handle = await createRedirectIntPayload({
      collections: [versionedArticlesCollection()],
    })
  }, 120_000)

  afterAll(async () => {
    await handle.destroy()
  })

  it('registers redirects collection with runtime slug', async () => {
    const custom = handle.payload.config.custom as { payloadRedirect?: { collectionSlug: string } }
    expect(custom.payloadRedirect?.collectionSlug).toBe('redirects')
    const found = await handle.payload.find({
      collection: 'redirects',
      limit: 1,
      overrideAccess: true,
    })
    expect(found.docs).toBeDefined()
  })
})
