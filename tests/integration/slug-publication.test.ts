import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { versionedArticlesCollection } from '../helpers/factories/versioned-document'
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from '../helpers/payload-harness'

describe.skipIf(!intDatabaseConfigured)('slug publication redirects', () => {
  let handle: RedirectIntHandle

  beforeAll(async () => {
    handle = await createRedirectIntPayload({
      collections: [versionedArticlesCollection()],
    })
  }, 120_000)

  afterAll(async () => {
    await handle.destroy()
  })

  it('first publication creates zero redirects', async () => {
    await handle.resetArticles()
    await handle.resetRedirects()
    await handle.payload.create({
      collection: 'articles',
      data: { slug: '/a', title: 'A' },
      draft: true,
    })
    const doc = await handle.payload.find({
      collection: 'articles',
      limit: 1,
      overrideAccess: true,
    })
    const id = doc.docs[0]?.id
    await handle.payload.update({
      collection: 'articles',
      id: id!,
      data: { _status: 'published' },
    })

    const redirects = await handle.payload.find({ collection: 'redirects', overrideAccess: true })
    expect(redirects.totalDocs).toBe(0)
  })

  it('published slug change creates one 301 redirect', async () => {
    await handle.resetArticles()
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
    })

    await handle.payload.update({
      collection: 'articles',
      id: created.id,
      data: { _status: 'published' },
    })

    const redirects = await handle.payload.find({ collection: 'redirects', overrideAccess: true })
    expect(redirects.totalDocs).toBe(1)
    expect(redirects.docs[0]?.from).toBe('/a')
    expect(redirects.docs[0]?.to).toBe('/b')
    expect(redirects.docs[0]?.StatusCode).toBe('301')
  })
})
