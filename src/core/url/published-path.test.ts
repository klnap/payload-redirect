import { describe, expect, it } from 'bun:test'
import {
  buildPublishedPath,
  mergeLocalePrefix,
  type ResolvedPublishedPathConfig,
  resolveLocaleRoutePrefix,
  resolvePathTemplate,
  resolvePublishedPathConfig,
} from '#redirect/core/url/published-path'

const projectsParams = {
  slug: { field: 'slug', localized: true },
}

describe('mergeLocalePrefix', () => {
  it('merges with schema winning', () => {
    expect(mergeLocalePrefix({ en: '', pl: '/pl' }, { de: '/de' })).toEqual({
      en: '',
      pl: '/pl',
      de: '/de',
    })
  })
})

describe('resolveLocaleRoutePrefix', () => {
  it('uses explicit prefix', () => {
    expect(resolveLocaleRoutePrefix({ pl: '/pl' }, 'pl')).toBe('/pl')
    expect(resolveLocaleRoutePrefix({ en: '' }, 'en')).toBe('')
  })

  it('returns null when map is set but locale missing', () => {
    expect(resolveLocaleRoutePrefix({ en: '', pl: '/pl' }, 'de')).toBeNull()
  })

  it('legacy empty map uses locale segment', () => {
    expect(resolveLocaleRoutePrefix({}, 'pl')).toBe('/pl')
  })
})

describe('buildPublishedPath', () => {
  const baseConfig = (
    overrides?: Partial<ResolvedPublishedPathConfig>
  ): ResolvedPublishedPathConfig => ({
    localePrefix: { en: '', pl: '/pl', de: '/de' },
    path: '/projects/[slug]',
    paths: {
      pl: '/projekty/[slug]',
      de: '/projekte/[slug]',
    },
    params: projectsParams,
    ...overrides,
  })

  it('composes prefix + localized path + slug', () => {
    expect(buildPublishedPath(baseConfig(), { slug: 'alfa' }, 'pl')).toBe('/pl/projekty/alfa')
    expect(buildPublishedPath(baseConfig(), { slug: 'alfa' }, 'en')).toBe('/projects/alfa')
    expect(buildPublishedPath(baseConfig(), { slug: 'alfa' }, 'de')).toBe('/de/projekte/alfa')
  })

  it('home path with prefix', () => {
    expect(
      buildPublishedPath(
        {
          localePrefix: { en: '', pl: '/pl' },
          path: '/',
        },
        {},
        'pl'
      )
    ).toBe('/pl')
  })

  it('builds custom paths before applying the configured locale prefix', () => {
    expect(
      buildPublishedPath(
        {
          localePrefix: { en: '/en' },
          getPath: ({ doc, locale }: { doc: Record<string, unknown>; locale: unknown }) =>
            locale === 'en' ? `/articles/${String(doc.slug)}` : null,
        },
        { slug: 'custom' },
        'en'
      )
    ).toBe('/en/articles/custom')
  })

  it('null when locale missing from prefix map', () => {
    expect(
      buildPublishedPath(baseConfig({ localePrefix: { en: '', pl: '/pl' } }), { slug: 'x' }, 'de')
    ).toBeNull()
  })

  it('falls back to legacy buildPreviewPath when only routes map', () => {
    expect(
      buildPublishedPath(
        {
          localePrefix: {},
          routes: {
            '/projects/[slug]': {
              en: '/projects/[slug]',
              pl: '/projekty/[slug]',
            },
          },
          params: projectsParams,
        },
        { slug: 'x' },
        'pl'
      )
    ).toBe('/pl/projekty/x')
  })

  it('uses path templates and locale-specific route templates', () => {
    expect(resolvePathTemplate({ paths: { en: '/localized' }, path: '/fallback' }, 'en')).toBe(
      '/localized'
    )
    expect(resolvePathTemplate({ path: '/fallback' }, 'en')).toBe('/fallback')
    expect(resolvePathTemplate({ routes: { '/route': { en: '/route/[slug]' } } }, 'en')).toBe(
      '/route/[slug]'
    )
    expect(resolvePathTemplate({ routes: { '/route': { fr: '/fr/[slug]' } } }, 'en')).toBeNull()
    expect(resolvePathTemplate({}, '')).toBeNull()
    expect(resolvePathTemplate({}, 'en')).toBeNull()
  })

  it('returns null for missing path templates, locales, or unresolved params', () => {
    expect(buildPublishedPath({ localePrefix: {}, path: '/[slug]' }, {}, 'en')).toBeNull()
    expect(buildPublishedPath({ localePrefix: {}, path: '/x' }, {}, null)).toBeNull()
    expect(
      buildPublishedPath({ localePrefix: {}, path: '/[slug]', params: projectsParams }, {}, 'en')
    ).toBeNull()
    expect(
      buildPublishedPath({ localePrefix: {}, routes: { '/route': { fr: '/fr/[slug]' } } }, {}, 'en')
    ).toBeNull()
    expect(
      buildPublishedPath(
        { localePrefix: { en: '' }, routes: { '/route': { fr: '/fr/[slug]' } } },
        {},
        'en'
      )
    ).toBeNull()
  })

  it('resolves a valid schema path and rejects empty configuration', () => {
    expect(resolvePublishedPathConfig({ en: '/en' }, { path: '/page' })).toEqual({
      localePrefix: { en: '/en' },
      path: '/page',
      paths: undefined,
      routes: undefined,
      params: undefined,
    })
    expect(resolvePublishedPathConfig(undefined, { routes: {} })).toBeNull()
    expect(resolvePublishedPathConfig(undefined, undefined)).toBeNull()
  })
})
