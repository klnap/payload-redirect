import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { versionedArticlesCollection } from '../helpers/factories/versioned-document'
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
  withPublishAllQuery,
} from '../helpers/payload-harness'

describe.skipIf(!intDatabaseConfigured)('localized publication', () => {
  let handle: RedirectIntHandle

  beforeAll(async () => {
    handle = await createRedirectIntPayload({
      localization: { locales: ['pl', 'en', 'de'], defaultLocale: 'en', fallback: true },
      collections: [versionedArticlesCollection(true)],
    })
  }, 120_000)

  afterAll(async () => {
    await handle.destroy()
  })

  it('creates per-locale redirects without locale field on records', async () => {
    await handle.resetRedirects()
    await handle.resetArticles()
    const created = await handle.payload.create({
      collection: 'articles',
      data: { slug: '/pl-old', title: 'A' },
      locale: 'pl',
      draft: true,
    })

    await handle.payload.update({
      collection: 'articles',
      id: created.id,
      data: { slug: '/pl-old' },
      locale: 'en',
      draft: true,
    })
    await handle.payload.update({
      collection: 'articles',
      id: created.id,
      data: { slug: '/de-alt' },
      locale: 'de',
      draft: true,
    })

    await handle.payload.update({
      collection: 'articles',
      id: created.id,
      data: { _status: 'published' },
      ...withPublishAllQuery,
    })

    await handle.payload.update({
      collection: 'articles',
      id: created.id,
      data: { slug: '/pl-new' },
      locale: 'pl',
      draft: true,
    })
    await handle.payload.update({
      collection: 'articles',
      id: created.id,
      data: { slug: '/en-old' },
      locale: 'en',
      draft: true,
    })
    await handle.payload.update({
      collection: 'articles',
      id: created.id,
      data: { slug: '/de-neu' },
      locale: 'de',
      draft: true,
    })

    await handle.payload.update({
      collection: 'articles',
      id: created.id,
      data: { _status: 'published' },
      ...withPublishAllQuery,
    })
    await handle.payload.update({
      collection: 'articles',
      id: created.id,
      data: { _status: 'published' },
      locale: 'de',
    })

    const redirects = await handle.payload.find({ collection: 'redirects', overrideAccess: true })
    const froms = redirects.docs.map((d) => d.from).sort()
    expect(froms).toEqual(['/de-alt', '/pl-old'].sort())
    expect(redirects.docs.every((d) => !('locale' in d))).toBe(true)
  })
})
