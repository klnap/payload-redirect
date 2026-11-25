import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { versionedArticlesCollection } from '../helpers/factories/versioned-document'
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
  withDraftQuery,
} from '../helpers/payload-harness'

describe.skipIf(!intDatabaseConfigured)('draft rename', () => {
  let handle: RedirectIntHandle

  beforeAll(async () => {
    handle = await createRedirectIntPayload({
      collections: [versionedArticlesCollection()],
    })
  })

  afterAll(async () => {
    await handle.destroy()
  })

  it('draft slug change without publish creates no redirect', async () => {
    await handle.resetRedirects()
    const created = await handle.payload.create({
      collection: 'articles',
      data: { slug: '/a', title: 'A', _status: 'published' },
    })

    await handle.payload.update({
      collection: 'articles',
      id: created.id,
      data: { slug: '/b' },
      draft: true,
      ...withDraftQuery,
    })

    const redirects = await handle.payload.find({ collection: 'redirects', overrideAccess: true })
    expect(redirects.totalDocs).toBe(0)
  })
})
