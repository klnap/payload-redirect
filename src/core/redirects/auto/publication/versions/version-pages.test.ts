import { describe, expect, it, mock } from 'bun:test'
import { fetchLocalePublishedDoc } from './document-locale'
import { fetchPublishedVersionPages, fetchVersionHistoryPages } from './version-pages'

describe('version and document readers', () => {
  it('reads a document by locale and returns undefined on lookup failure', async () => {
    const findByID = mock(async () => ({ slug: 'hello' }))
    const req = { payload: { findByID } } as never
    const options = { req, collection: { slug: 'pages' } as never, docId: 0, locale: 'fr' }

    expect(await fetchLocalePublishedDoc(options)).toEqual({ slug: 'hello' })
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'pages',
        id: 0,
        locale: 'fr',
        fallbackLocale: false,
        draft: false,
        overrideAccess: true,
      })
    )
    expect(
      await fetchLocalePublishedDoc({
        ...options,
        req: {
          payload: { findByID: mock(async () => Promise.reject(new Error('missing'))) },
        } as never,
      })
    ).toBeUndefined()
  })

  it('pages published versions and applies locale status filters', async () => {
    const findVersions = mock(async ({ page }: { page: number }) => ({
      docs:
        page === 1
          ? [
              { version: { _status: 'published', slug: 'one' } },
              { version: { _status: 'draft', slug: 'draft' } },
            ]
          : [{ version: { _status: { fr: 'published' }, slug: { fr: 'deux' } } }],
      hasNextPage: page === 1,
    }))
    const req = { payload: { findVersions } } as never

    expect(
      await fetchPublishedVersionPages({
        req,
        collectionSlug: 'pages',
        docId: 'id',
        locale: 'fr',
        versionLocale: 'fr',
        versionFilter: { localizeStatus: true, defaultLocale: 'fr', identifier: 'slug' },
      })
    ).toEqual([
      { version: { _status: 'published', slug: 'one' } },
      { version: { _status: { fr: 'published' }, slug: { fr: 'deux' } } },
    ])
    expect(findVersions).toHaveBeenCalledTimes(2)
    expect(findVersions.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ page: 1, locale: 'fr', limit: 50 })
    )
  })

  it('pages version history with and without locale and drops snapshots and autosaves', async () => {
    const findVersions = mock(async (_query: Record<string, unknown>) => ({
      docs: [
        { id: 1, version: { slug: 'one' } },
        { id: 2, snapshot: true },
        { id: 3, autosave: true },
      ],
      hasNextPage: false,
    }))
    const req = { payload: { findVersions } } as never

    expect(
      await fetchVersionHistoryPages({
        req,
        collectionSlug: 'pages',
        docId: 1,
        versionLocale: 'en',
      })
    ).toEqual([{ id: 1, version: { slug: 'one' } }])
    expect(findVersions.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ page: 1, locale: 'en', limit: 50 })
    )
    findVersions.mockClear()
    await fetchVersionHistoryPages({ req, collectionSlug: 'pages', docId: 1 })
    expect(findVersions.mock.calls[0]?.[0]).not.toHaveProperty('locale')
  })

  it('fetches every page of version history', async () => {
    const findVersions = mock(async ({ page }: { page: number }) => ({
      docs: [{ id: page, version: { slug: `row-${page}` } }],
      hasNextPage: page === 1,
    }))
    const req = { payload: { findVersions } } as never
    expect(await fetchVersionHistoryPages({ req, collectionSlug: 'pages', docId: 'id' })).toEqual([
      { id: 1, version: { slug: 'row-1' } },
      { id: 2, version: { slug: 'row-2' } },
    ])
    expect(findVersions).toHaveBeenCalledTimes(2)
  })
})
