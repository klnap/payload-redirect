import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import type { CollectionConfig } from 'payload'
import {
  createRedirectIntPayload,
  draftVersions,
  intDatabaseConfigured,
  type RedirectIntHandle,
  withPublishAllLocales,
} from '../helpers/payload-harness'

const articlesWithPublishedPath: CollectionConfig = {
  slug: 'articles',
  versions: draftVersions,
  fields: [
    { name: 'slug', type: 'text', required: true },
    { name: 'title', type: 'text' },
  ],
  custom: { redirect: { path: '/articles/[slug]' } },
}

const articlesWithCustomPath: CollectionConfig = {
  slug: 'custom-articles',
  versions: draftVersions,
  fields: [
    { name: 'slug', type: 'text', required: true },
    { name: 'category', type: 'text', required: true },
  ],
  custom: {
    redirect: {
      getPath: ({ doc }: { doc: Record<string, unknown>; locale: string | null }) =>
        `/articles/${String(doc.category)}/${String(doc.slug)}`,
    },
  },
}

describe.skipIf(!intDatabaseConfigured)('auto redirects with published path template', () => {
  let handle: RedirectIntHandle

  beforeAll(async () => {
    handle = await createRedirectIntPayload({
      collections: [articlesWithPublishedPath, articlesWithCustomPath],
    })
  }, 120_000)

  afterAll(async () => {
    await handle.destroy()
  })

  it('creates a redirect when the published path changes', async () => {
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

  it('passes previous and current published snapshots to getPath', async () => {
    await handle.resetArticles()
    await handle.resetRedirects()

    const created = await handle.payload.create({
      collection: 'custom-articles',
      data: { slug: 'old', category: 'news', _status: 'published' },
    })

    await handle.payload.update({
      collection: 'custom-articles',
      id: created.id,
      data: { slug: 'new', category: 'guides' },
      draft: true,
    })

    await handle.payload.update({
      collection: 'custom-articles',
      id: created.id,
      data: { _status: 'published' },
    })

    const redirects = await handle.payload.find({ collection: 'redirects', overrideAccess: true })
    expect(redirects.docs.map(({ from, to }) => ({ from, to }))).toEqual([
      { from: '/articles/news/old', to: '/articles/guides/new' },
    ])
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
          paths: { en: '/articles/[slug]', pl: '/artykuly/[slug]' },
        },
      },
    }

    beforeAll(async () => {
      handle = await createRedirectIntPayload({
        localePrefixes: { en: '', pl: '/pl' },
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
        ...withPublishAllLocales,
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
        publishSpecificLocale: 'en',
      })
      await handle.payload.update({
        collection: 'articles',
        id: created.id,
        data: { _status: 'published' },
        locale: 'pl',
        publishSpecificLocale: 'pl',
      })

      const redirects = await handle.payload.find({ collection: 'redirects', overrideAccess: true })
      const froms = redirects.docs
        .map((d) => d.from)
        .sort((left, right) => left.localeCompare(right))
      expect(froms).toEqual(
        ['/articles/en-old', '/pl/artykuly/pl-stary'].sort((left, right) =>
          left.localeCompare(right)
        )
      )
      const plRule = redirects.docs.find((d) => d.from === '/pl/artykuly/pl-stary')
      expect(plRule?.to).toBe('/pl/artykuly/pl-nowy')
    })
  }
)
