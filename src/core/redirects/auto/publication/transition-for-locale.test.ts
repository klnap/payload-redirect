import { describe, expect, it, mock } from 'bun:test'
import { transitionForLocale } from './transition-for-locale'

const run = async ({
  hookDoc = { slug: 'current', _status: 'published' },
  versions = [],
  publishedDoc = { slug: 'current', _status: 'published' },
  draftDoc,
  localizedField = false,
  locale = 'en',
  defaultLocale = 'en',
  publishIntent = false,
  versionPages = false,
  docsByLocale,
}: {
  hookDoc?: Record<string, unknown>
  versions?: Record<string, unknown>[]
  publishedDoc?: Record<string, unknown> | null
  draftDoc?: Record<string, unknown> | undefined
  localizedField?: boolean
  locale?: string
  defaultLocale?: string
  publishIntent?: boolean
  versionPages?: boolean
  docsByLocale?: Record<string, Record<string, unknown> | undefined>
} = {}) => {
  const findByID = mock(
    async ({ draft, locale: requestedLocale }: { draft?: boolean; locale?: string }) => {
      if (draft) return draftDoc
      return docsByLocale?.[requestedLocale ?? locale] ?? publishedDoc ?? undefined
    }
  )
  const findVersions = mock(async ({ page }: { page: number }) => ({
    docs: page === 1 ? versions : [],
    hasNextPage: versionPages && page === 1,
  }))
  const req = {
    locale,
    payload: {
      config: { localization: { defaultLocale, locales: [defaultLocale, locale] } },
      findByID,
      findVersions,
    },
  } as never
  const result = await transitionForLocale({
    req,
    collection: {
      slug: 'pages',
      versions: { drafts: { localizeStatus: localizedField } },
    } as never,
    docId: 'id',
    locale,
    identifier: 'slug',
    localizedField,
    hookDoc,
    publishIntent,
  })
  return { result, findByID, findVersions }
}

describe('transitionForLocale', () => {
  it('returns unpublished when no published history or published document exists', async () => {
    const { result } = await run({
      hookDoc: { slug: 'draft', _status: 'draft' },
      publishedDoc: null,
    })
    expect(result).toEqual({ published: false })
  })

  it('returns unpublished when history has only one version and there is no publish signal', async () => {
    const { result } = await run({
      hookDoc: { slug: 'draft', _status: 'draft' },
      publishedDoc: null,
      versions: [{ version: { slug: 'old', _status: 'published' } }],
    })
    expect(result).toEqual({ published: false })
  })

  it('returns published without a transition when no current identifier is available', async () => {
    const { result } = await run({
      hookDoc: { _status: 'published' },
      publishedDoc: { _status: 'published' },
    })
    expect(result).toEqual({ published: true })
  })

  it('finds the previous scalar identifier and emits a transition', async () => {
    const { result } = await run({
      versions: [
        { version: { slug: 'current', _status: 'published' } },
        { version: { slug: 'previous', _status: 'published' } },
      ],
    })
    expect(result).toMatchObject({
      published: true,
      locale: 'en',
      previous: 'previous',
      current: 'current',
    })
  })

  it('uses the localized draft and fetches version history for a publish intent', async () => {
    const { result, findByID, findVersions } = await run({
      localizedField: true,
      publishIntent: true,
      hookDoc: { slug: { en: 'current' }, _status: { en: 'published' } },
      draftDoc: { slug: { en: 'current' } },
      versions: [{ version: { slug: { en: 'previous' }, _status: { en: 'published' } } }],
    })
    expect(result).toMatchObject({
      published: true,
      locale: 'en',
      previous: 'previous',
      current: 'current',
    })
    expect(findByID).toHaveBeenCalledTimes(2)
    expect(findVersions).toHaveBeenCalledTimes(2)
  })

  it('filters inherited non-default localized paths and duplicate version identifiers', async () => {
    const { result } = await run({
      locale: 'fr',
      defaultLocale: 'en',
      localizedField: true,
      publishIntent: true,
      hookDoc: { slug: { en: 'default', fr: 'current' }, _status: { fr: 'published' } },
      draftDoc: { slug: { en: 'default', fr: 'current' } },
      versions: [
        { version: { slug: { en: 'default', fr: 'default' }, _status: { fr: 'published' } } },
        { version: { slug: { en: 'old', fr: 'old' }, _status: { fr: 'published' } } },
        { version: { slug: { en: 'old', fr: 'old' }, _status: { fr: 'published' } } },
      ],
    })
    expect(result).toMatchObject({
      published: true,
      locale: 'fr',
      previous: 'old',
      current: 'current',
    })
  })

  it('skips previous paths matching another locale on the default locale', async () => {
    const { result } = await run({
      localizedField: true,
      publishIntent: true,
      hookDoc: { slug: { en: 'current', fr: 'previous' }, _status: { en: 'published' } },
      draftDoc: { slug: { en: 'current' } },
      versions: [{ version: { slug: { en: 'previous' }, _status: { en: 'published' } } }],
    })
    expect(result).toEqual({ published: true })
  })

  it('ignores localized history rows without the requested locale value', async () => {
    const { result } = await run({
      locale: 'fr',
      defaultLocale: 'en',
      localizedField: true,
      publishIntent: true,
      hookDoc: { slug: { en: 'current', fr: 'current' }, _status: { fr: 'published' } },
      draftDoc: { slug: { en: 'current', fr: 'current' } },
      versions: [
        { version: { slug: { en: 'old' }, _status: { fr: 'published' } } },
        { version: { slug: { en: 'previous', fr: 'previous' }, _status: { fr: 'published' } } },
      ],
    })
    expect(result.previous).toBe('previous')
  })

  it('filters inherited, missing, and duplicate localized version identifiers', async () => {
    const { result } = await run({
      locale: 'fr',
      defaultLocale: 'en',
      localizedField: true,
      hookDoc: { slug: { en: 'default', fr: 'current' }, _status: { fr: 'published' } },
      publishedDoc: { slug: { en: 'default', fr: 'current' }, _status: { fr: 'published' } },
      versions: [
        {},
        { version: { slug: 'old', _status: { fr: 'published' } } },
        { version: { slug: { en: 'default', fr: 'default' }, _status: { fr: 'published' } } },
        { version: { slug: { en: 'old', fr: 'old' }, _status: { fr: 'published' } } },
        { version: { slug: { en: 'old', fr: 'old' }, _status: { fr: 'published' } } },
      ],
    })
    expect(result).toMatchObject({
      published: true,
      locale: 'fr',
      previous: 'old',
      current: 'current',
    })
  })

  it('falls back to the current version snapshot when the hook has no identifier', async () => {
    const { result } = await run({
      hookDoc: { _status: 'published' },
      publishedDoc: { _status: 'published' },
      versions: [
        { version: { slug: 'new', _status: 'published' } },
        { version: { slug: 'old', _status: 'published' } },
      ],
    })
    expect(result).toMatchObject({
      published: true,
      locale: 'en',
      previous: 'old',
      current: 'new',
    })
  })

  it('loads the default-locale identifier when the hook omits it', async () => {
    const { result, findByID } = await run({
      locale: 'fr',
      defaultLocale: 'en',
      localizedField: true,
      publishIntent: true,
      hookDoc: { slug: { fr: 'current' }, _status: { fr: 'published' } },
      draftDoc: { slug: { fr: 'current' } },
      publishedDoc: { slug: { fr: 'current' }, _status: { fr: 'published' } },
      docsByLocale: {
        en: { slug: { en: 'default' }, _status: { en: 'published' } },
        fr: { slug: { fr: 'current' }, _status: { fr: 'published' } },
      },
      versions: [
        { version: { slug: { fr: 'current' }, _status: { fr: 'published' } } },
        { version: { slug: { fr: 'old' }, _status: { fr: 'published' } } },
      ],
    })
    expect(result).toMatchObject({
      published: true,
      locale: 'fr',
      previous: 'old',
      current: 'current',
    })
    expect(findByID).toHaveBeenCalledTimes(3)
  })
})
