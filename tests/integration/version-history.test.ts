import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { versionedArticlesCollection } from '../helpers/factories/versioned-document'
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from '../helpers/payload-harness'

describe.skipIf(!intDatabaseConfigured)('version history', () => {
  let handle: RedirectIntHandle

  beforeAll(async () => {
    handle = await createRedirectIntPayload({
      collections: [versionedArticlesCollection()],
    })
  }, 120_000)

  afterAll(async () => {
    await handle.destroy()
  })

  it('skips intervening drafts and links last two published slugs', async () => {
    await handle.resetArticles()
    await handle.resetRedirects()
    const created = await handle.payload.create({
      collection: 'articles',
      data: { slug: '/a', title: 'A', _status: 'published' },
    })

    for (const slug of ['/b', '/c', '/d', '/e']) {
      await handle.payload.update({
        collection: 'articles',
        id: created.id,
        data: { slug },
        draft: true,
      })
    }

    await handle.payload.update({
      collection: 'articles',
      id: created.id,
      data: { slug: '/e', _status: 'published' },
    })

    const redirects = await handle.payload.find({ collection: 'redirects', overrideAccess: true })
    expect(redirects.totalDocs).toBe(1)
    expect(redirects.docs[0]?.from).toBe('/a')
    expect(redirects.docs[0]?.to).toBe('/e')
  })
})
