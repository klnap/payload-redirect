import { describe, expect, it, mock } from 'bun:test'
import { getPublicationTransition } from './get-publication-transition'

const args = ({
  collection = { slug: 'pages', fields: [{ name: 'slug' }], versions: { drafts: true } },
  doc = { id: 'id', slug: 'new', _status: 'published' },
  data = { _status: 'published' },
  query = { locale: 'en' },
  context = {},
  locales = ['en'],
}: {
  collection?: Record<string, unknown>
  doc?: Record<string, unknown>
  data?: Record<string, unknown>
  query?: Record<string, unknown>
  context?: Record<string, unknown>
  locales?: string[]
} = {}) => {
  const findByID = mock(async () => undefined)
  const findVersions = mock(async () => ({ docs: [], hasNextPage: false }))
  return {
    args: {
      req: {
        context,
        query,
        payload: {
          config: { localization: { locales, defaultLocale: locales[0] } },
          findByID,
          findVersions,
        },
      },
      collection,
      doc,
      data,
    } as never,
    findVersions,
  }
}

describe('getPublicationTransition', () => {
  it('skips non-versioned collections, draft saves, context skips, and unpublished documents', async () => {
    const noVersions = args({ collection: { slug: 'pages', fields: [] } })
    expect(await getPublicationTransition(noVersions.args, { identifier: 'slug' })).toEqual([])

    const draftSave = args({ query: { locale: 'en', draft: true } })
    expect(await getPublicationTransition(draftSave.args, { identifier: 'slug' })).toEqual([])

    const contextSkip = args({ context: { payloadRedirectSkipAuto: true } })
    expect(await getPublicationTransition(contextSkip.args, { identifier: 'slug' })).toEqual([])

    const unpublished = args({ doc: { id: 'id', slug: 'draft', _status: 'draft' } })
    expect(await getPublicationTransition(unpublished.args, { identifier: 'slug' })).toEqual([])
  })

  it('uses published locales inferred from localized status when request locale is absent', async () => {
    const ctx = args({
      collection: {
        slug: 'pages',
        fields: [{ name: 'slug', localized: true }],
        versions: { drafts: { localizeStatus: true } },
      },
      doc: { id: 'id', slug: { en: 'new' }, _status: { en: 'published', fr: 'draft' } },
      data: { _status: { en: 'draft' } },
      query: {},
      locales: ['en', 'fr'],
    })

    const transitions = await getPublicationTransition(ctx.args, { identifier: 'slug' })
    expect(transitions).toEqual([{ published: true }])
    expect(ctx.findVersions).toHaveBeenCalledTimes(1)
  })

  it('accepts publishAllLocales when configured locales are available', async () => {
    const ctx = args({
      query: { publishAllLocales: true },
      locales: ['en', 'fr'],
    })
    expect(await getPublicationTransition(ctx.args, { identifier: 'slug' })).toEqual([
      { published: true },
      { published: true },
    ])
    expect(ctx.findVersions).toHaveBeenCalledTimes(2)
  })

  it('returns no transitions when publishing all locales without configured locales', async () => {
    const ctx = args({ query: { publishAllLocales: true }, locales: [] })
    expect(await getPublicationTransition(ctx.args, { identifier: 'slug' })).toEqual([])
    expect(ctx.findVersions).not.toHaveBeenCalled()
  })
})
