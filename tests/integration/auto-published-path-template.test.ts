import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import type { CollectionConfig } from 'payload'
import {
  createRedirectIntPayload,
  draftVersions,
  intDatabaseConfigured,
  type RedirectIntHandle,
  withPublishAllQuery,
} from '../helpers/payload-harness'

const articlesWithPublishedPath: CollectionConfig = {
  slug: 'articles',
  versions: draftVersions,
  fields: [
    { name: 'slug', type: 'text', required: true },
    { name: 'title', type: 'text' },
  ],
  custom: {
    redirect: {
      identifier: 'slug',
      publishedLink: {
        path: '/articles/[slug]',
        params: { slug: { field: 'slug' } },
      },
    },
  },
}

describe.skipIf(!intDatabaseConfigured)('auto redirects with published path template', () => {
  let handle: RedirectIntHandle

  beforeAll(async () => {
    handle = await createRedirectIntPayload({
      localePrefix: { en: '' },
      collections: [articlesWithPublishedPath],
    })
  }, 120_000)

  afterAll(async () => {
    await handle.destroy()
  })

  it('creates redirect from built paths when identifier changes on publish', async () => {
    await handle.resetArticles()
    await handle.resetRedirects()

    const created = await handle.payload.create({
      collection: 'articles',
      data: { slug: 'old-slug', title: 'A', _status: 'published' },
    })

    await handle.payload.update({
      collection: 'articles',
      id: created.id,
      data: { slug: 'new-slug' },
      draft: true,
    })

    await handle.payload.update({
      collection: 'articles',
      id: created.id,
      data: { _status: 'published' },
    })

    const redirects = await handle.payload.find({ collection: 'redirects', overrideAccess: true })
    expect(redirects.totalDocs).toBe(1)
    expect(redirects.docs[0]?.from).toBe('/articles/old-slug')
    expect(redirects.docs[0]?.to).toBe('/articles/new-slug')
    expect(redirects.docs[0]?.origin).toBe('auto')
  })
})

describe.skipIf(!intDatabaseConfigured)(
  'auto redirects with localized published path template',
  () => {
    let handle: RedirectIntHandle

    const localizedArticles: CollectionConfig = {
      slug: 'articles',
      versions: { drafts: { autosave: false, localizeStatus: true } },
      fields: [
        { name: 'slug', type: 'text', required: true, localized: true },
        { name: 'title', type: 'text' },
      ],
      custom: {
        redirect: {
          identifier: 'slug',
          publishedLink: {
            path: '/articles/[slug]',
            paths: { pl: '/artykuly/[slug]' },
            params: { slug: { field: 'slug', localized: true } },
          },
        },
      },
    }

    beforeAll(async () => {
      handle = await createRedirectIntPayload({
        localePrefix: { en: '', pl: '/pl' },
        localization: { locales: ['en', 'pl'], defaultLocale: 'en', fallback: true },
        collections: [localizedArticles],
      })
    }, 120_000)

    afterAll(async () => {
      await handle.destroy()
    })

    it('builds per-locale from/to paths on publish-all', async () => {
      await handle.resetArticles()
      await handle.resetRedirects()

      const created = await handle.payload.create({
        collection: 'articles',
        data: { slug: 'en-old', title: 'A' },
        locale: 'en',
        draft: true,
      })

      await handle.payload.update({
        collection: 'articles',
        id: created.id,
        data: { slug: 'pl-stary' },
        locale: 'pl',
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
        data: { slug: 'en-new' },
        locale: 'en',
        draft: true,
      })
      await handle.payload.update({
        collection: 'articles',
        id: created.id,
        data: { slug: 'pl-nowy' },
        locale: 'pl',
        draft: true,
      })

      await handle.payload.update({
        collection: 'articles',
        id: created.id,
        data: { _status: 'published' },
        locale: 'en',
        query: { publishSpecificLocale: 'en' },
      })
      await handle.payload.update({
        collection: 'articles',
        id: created.id,
        data: { _status: 'published' },
        locale: 'pl',
        query: { publishSpecificLocale: 'pl' },
      })

      const redirects = await handle.payload.find({ collection: 'redirects', overrideAccess: true })
      const froms = redirects.docs.map((d) => d.from).sort()
      expect(froms).toEqual(['/articles/en-old', '/pl/artykuly/pl-stary'].sort())
      const plRule = redirects.docs.find((d) => d.from === '/pl/artykuly/pl-stary')
      expect(plRule?.to).toBe('/pl/artykuly/pl-nowy')
    })
  }
)
