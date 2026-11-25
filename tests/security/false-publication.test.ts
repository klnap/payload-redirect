import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { versionedArticlesCollection } from '../helpers/factories/versioned-document'
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from '../helpers/payload-harness'

describe.skipIf(!intDatabaseConfigured)('false publication', () => {
  let handle: RedirectIntHandle

  beforeAll(async () => {
    handle = await createRedirectIntPayload({
      collections: [versionedArticlesCollection()],
    })
  })

  afterAll(async () => {
    await handle.destroy()
  })

  it('republish without slug change creates no redirect', async () => {
    await handle.resetRedirects()
    const created = await handle.payload.create({
      collection: 'articles',
      data: { slug: '/same', title: 'A', _status: 'published' },
    })

    await handle.payload.update({
      collection: 'articles',
      id: created.id,
      data: { title: 'B' },
      draft: true,
    })

    await handle.payload.update({
      collection: 'articles',
      id: created.id,
      data: { _status: 'published' },
    })

    const redirects = await handle.payload.find({ collection: 'redirects', overrideAccess: true })
    expect(redirects.totalDocs).toBe(0)
  })
})
