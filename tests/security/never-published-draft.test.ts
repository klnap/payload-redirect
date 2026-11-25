import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { versionedArticlesCollection } from '../helpers/factories/versioned-document'
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
  withDraftQuery,
} from '../helpers/payload-harness'

describe.skipIf(!intDatabaseConfigured)('never-published draft', () => {
  let handle: RedirectIntHandle

  beforeAll(async () => {
    handle = await createRedirectIntPayload({
      collections: [versionedArticlesCollection()],
    })
  })

  afterAll(async () => {
    await handle.destroy()
  })

  it('draft save does not create redirects', async () => {
    await handle.resetRedirects()
    await handle.payload.create({
      collection: 'articles',
      data: { slug: '/draft-only', title: 'D' },
      draft: true,
      ...withDraftQuery,
    })

    const redirects = await handle.payload.find({ collection: 'redirects', overrideAccess: true })
    expect(redirects.totalDocs).toBe(0)
  })
})
