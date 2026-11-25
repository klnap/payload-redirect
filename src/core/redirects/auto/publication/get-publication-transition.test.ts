import { describe, expect, it, mock } from 'bun:test'
import { REDIRECT_CONTEXT_KEYS } from '#redirect/core/redirects/context-keys'
import { getPublicationTransition } from './get-publication-transition'

const makeArgs = ({
  collection = { slug: 'pages', fields: [], versions: { drafts: true } },
  doc = { id: 'page-1', _status: 'published' },
  query = { locale: 'en' },
  context = {},
  locale = 'en',
  locales = ['en'],
  currentDoc = { id: 'page-1', _status: 'published' },
  versions = [{ version: { _status: 'published' } }],
}: {
  collection?: Record<string, unknown>
  doc?: Record<string, unknown>
  query?: Record<string, unknown>
  context?: Record<string, unknown>
  locale?: string | null
  locales?: string[]
  currentDoc?: Record<string, unknown>
  versions?: Record<string, unknown>[]
} = {}) => {
  const findByID = mock(async (_args: unknown) => currentDoc)
  const findVersions = mock(async (_args: unknown) => ({ docs: versions, hasNextPage: false }))
  const req = {
    context,
    query,
    locale,
    payload: {
      config: { localization: locales.length ? { locales, defaultLocale: locales[0] } : false },
      findByID,
      findVersions,
    },
  }
  return {
    args: { req, collection, doc, data: {} },
    findByID,
    findVersions,
  }
}

describe('getPublicationTransition', () => {
  it('skips non-versioned collections, draft saves, and internal writes', async () => {
    const noVersions = makeArgs({ collection: { slug: 'pages', fields: [] } })
    expect(await getPublicationTransition(noVersions.args as never)).toEqual([])

    const draftSave = makeArgs({ query: { locale: 'en', draft: true } })
    expect(await getPublicationTransition(draftSave.args as never)).toEqual([])

    const internalWrite = makeArgs({ context: { [REDIRECT_CONTEXT_KEYS.skipAuto]: true } })
    expect(await getPublicationTransition(internalWrite.args as never)).toEqual([])
    expect(internalWrite.findByID).not.toHaveBeenCalled()
  })

  it('returns locale-specific published snapshots without fallback locales', async () => {
    const ctx = makeArgs({
      currentDoc: { id: 'page-1', slug: 'current', _status: 'published' },
      versions: [
        { version: { slug: 'current', _status: 'published' } },
        { version: { slug: 'previous', _status: 'published' } },
      ],
    })

    expect(await getPublicationTransition(ctx.args as never)).toEqual([
      {
        locale: 'en',
        currentDoc: { id: 'page-1', slug: 'current', _status: 'published' },
        publishedDocs: [
          { slug: 'current', _status: 'published' },
          { slug: 'previous', _status: 'published' },
        ],
      },
    ])
    expect(ctx.findByID.mock.calls[0]?.[0]).toMatchObject({
      locale: 'en',
      fallbackLocale: false,
    })
    expect(ctx.findVersions.mock.calls[0]?.[0]).toMatchObject({
      locale: 'en',
      fallbackLocale: false,
    })
  })

  it('processes only published locales for localized status', async () => {
    const ctx = makeArgs({
      locale: null,
      query: {},
      locales: ['en', 'fr'],
      collection: { slug: 'pages', fields: [], versions: { drafts: { localizeStatus: true } } },
      doc: { id: 'page-1', _status: { en: 'published', fr: 'draft' } },
      currentDoc: { id: 'page-1', _status: { en: 'published', fr: 'draft' } },
    })

    const transitions = await getPublicationTransition(ctx.args as never)
    expect(transitions.map(({ locale }) => locale)).toEqual(['en'])
    expect(ctx.findByID).toHaveBeenCalledTimes(1)
    expect(ctx.findVersions).toHaveBeenCalledTimes(1)
    expect(ctx.findVersions.mock.calls[0]?.[0]).toMatchObject({ locale: 'en' })
  })
  it('honors publish-all before Payload’s default request locale', async () => {
    const ctx = makeArgs({
      locale: 'en',
      query: { locale: 'en', publishAllLocales: 'true' },
      locales: ['en', 'pl'],
      collection: { slug: 'pages', fields: [], versions: { drafts: { localizeStatus: true } } },
      doc: { id: 'page-1', _status: { en: 'published', pl: 'published' } },
      currentDoc: { id: 'page-1', _status: 'published' },
    })
    expect((await getPublicationTransition(ctx.args as never)).map(({ locale }) => locale)).toEqual(
      ['en', 'pl']
    )
  })
  it('uses localized publication status before Payload’s default request locale', async () => {
    const ctx = makeArgs({
      locale: 'en',
      query: {},
      locales: ['en', 'pl'],
      collection: { slug: 'pages', fields: [], versions: { drafts: { localizeStatus: true } } },
      doc: { id: 'page-1', _status: { en: 'published', pl: 'published' } },
      currentDoc: { id: 'page-1', _status: 'published' },
    })
    expect((await getPublicationTransition(ctx.args as never)).map(({ locale }) => locale)).toEqual(
      ['en', 'pl']
    )
  })
  it('accepts the published snapshot returned for a localized locale', async () => {
    const ctx = makeArgs({
      locale: null,
      query: {},
      locales: ['en', 'pl'],
      collection: { slug: 'pages', fields: [], versions: { drafts: { localizeStatus: true } } },
      doc: { id: 'page-1', _status: { en: 'published', pl: 'draft' } },
      currentDoc: { id: 'page-1', _status: 'published' },
    })
    expect(await getPublicationTransition(ctx.args as never)).toHaveLength(1)
  })

  it('handles non-localized Payload configs without inventing a locale', async () => {
    const ctx = makeArgs({
      locale: null,
      query: {},
      locales: [],
      currentDoc: { id: 'page-1', slug: 'current', _status: 'published' },
    })

    expect(await getPublicationTransition(ctx.args as never)).toHaveLength(1)
    expect(ctx.findByID.mock.calls[0]?.[0]).not.toHaveProperty('locale')
    expect(ctx.findVersions.mock.calls[0]?.[0]).not.toHaveProperty('locale')
  })

  it('does not read history for unpublished documents', async () => {
    const ctx = makeArgs({
      currentDoc: { id: 'page-1', _status: 'draft' },
    })

    expect(await getPublicationTransition(ctx.args as never)).toEqual([])
    expect(ctx.findVersions).not.toHaveBeenCalled()
  })
})
