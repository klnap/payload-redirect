import { describe, expect, it, mock, spyOn } from 'bun:test'
import * as publishedPaths from '#redirect/core/url/published-path'
import { createRedirect } from './create-redirect'

const args = ({
  context = {},
  query = { locale: 'en' },
  collection = { slug: 'pages', versions: { drafts: true }, fields: [{ name: 'slug' }] },
  doc = { id: 'page-1', slug: 'new', _status: 'published' },
  data = { _status: 'published' },
  versions = [
    { version: { slug: 'new', _status: 'published' } },
    { version: { slug: 'old', _status: 'published' } },
  ],
  existing = [],
}: {
  context?: Record<string, unknown>
  query?: Record<string, unknown>
  collection?: Record<string, unknown>
  doc?: Record<string, unknown>
  data?: Record<string, unknown>
  versions?: Record<string, unknown>[]
  existing?: Record<string, unknown>[]
} = {}) => {
  const findByID = mock(async () => doc)
  const findVersions = mock(async () => ({ docs: versions, hasNextPage: false }))
  const find = mock(async () => ({ docs: existing }))
  const create = mock(async () => ({}))
  const req = {
    context,
    query,
    locale: 'en',
    payload: {
      config: { custom: { payloadRedirect: { collectionSlug: 'redirects' } } },
      findByID,
      findVersions,
      find,
      create,
    },
  }
  return {
    args: { req, collection, doc, data, operation: 'update' } as never,
    findByID,
    findVersions,
    find,
    create,
    doc,
  }
}

describe('createRedirect', () => {
  it('returns immediately when auto redirects are skipped or the collection has no drafts', async () => {
    const skipped = args({ context: { payloadRedirectSkipAuto: true } })
    await expect(createRedirect({ identifier: 'slug' })(skipped.args)).resolves.toBe(skipped.doc)
    expect(skipped.findVersions).not.toHaveBeenCalled()

    const withoutDrafts = args({ collection: { slug: 'pages', fields: [] } })
    await expect(createRedirect({ identifier: 'slug' })(withoutDrafts.args)).resolves.toBe(
      withoutDrafts.doc
    )
    expect(withoutDrafts.findVersions).not.toHaveBeenCalled()
  })

  it('returns without querying redirects when no identifier transition exists', async () => {
    const current = args({ versions: [{ version: { slug: 'new', _status: 'published' } }] })
    await expect(createRedirect({ identifier: 'slug' })(current.args)).resolves.toBe(current.doc)
    expect(current.find).not.toHaveBeenCalled()
  })

  it('creates a normalized redirect for a published identifier change', async () => {
    const ctx = args()
    await expect(createRedirect({ identifier: 'slug' })(ctx.args)).resolves.toBe(ctx.doc)
    expect(ctx.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'redirects',
        where: { from: { equals: '/old' } },
      })
    )
    expect(ctx.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'redirects',
        data: {
          from: '/old',
          to: '/new',
          StatusCode: '301',
          enabled: true,
          origin: 'auto',
        },
      })
    )
  })

  it('skips transitions when draft saving, skipped by context, or still unpublished', async () => {
    const draftSave = args({ query: { locale: 'en', draft: 'true' } })
    await createRedirect({ identifier: 'slug' })(draftSave.args)
    expect(draftSave.findVersions).not.toHaveBeenCalled()

    const unpublished = args({ doc: { id: 'page-1', slug: 'new', _status: 'draft' } })
    await createRedirect({ identifier: 'slug' })(unpublished.args)
    expect(unpublished.find).not.toHaveBeenCalled()
  })

  it('builds localized published paths and skips invalid or identical routes', async () => {
    const localized = args({
      collection: {
        slug: 'pages',
        versions: { drafts: true },
        fields: [{ name: 'slug', localized: true }],
        custom: {
          redirect: {
            publishedLink: {
              path: '/articles/[slug]',
              params: { slug: { field: 'slug', localized: true } },
            },
          },
        },
      },
    })
    await createRedirect({ identifier: 'slug' })(localized.args)
    expect(localized.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ from: '/en/articles/old', to: '/en/articles/new' }),
      })
    )

    const identical = args({
      collection: {
        slug: 'pages',
        versions: { drafts: true },
        fields: [{ name: 'slug' }],
        custom: { redirect: { publishedLink: { path: '/fixed' } } },
      },
    })
    await createRedirect({ identifier: 'slug' })(identical.args)
    expect(identical.find).not.toHaveBeenCalled()

    const invalid = args({
      collection: {
        slug: 'pages',
        versions: { drafts: true },
        fields: [{ name: 'slug' }],
        custom: {
          redirect: {
            publishedLink: { path: 'http://[invalid', localePrefix: { en: '' } },
          },
        },
      },
    })
    const buildPath = spyOn(publishedPaths, 'buildPublishedPath').mockReturnValue('http://[invalid')
    await createRedirect({ identifier: 'slug' })(invalid.args)
    buildPath.mockRestore()
    expect(invalid.find).not.toHaveBeenCalled()

    const missingParam = args({
      collection: {
        slug: 'pages',
        versions: { drafts: true },
        fields: [{ name: 'slug' }],
        custom: { redirect: { publishedLink: { path: '/articles/[missing]' } } },
      },
    })
    await createRedirect({ identifier: 'slug' })(missingParam.args)
    expect(missingParam.find).not.toHaveBeenCalled()
  })
})
