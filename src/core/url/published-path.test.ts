import { describe, expect, it } from 'bun:test'
import { buildPublishedPath, isValidLocalePrefix } from './published-path'
import { isValidPathTemplate } from './route-params'

describe('buildPublishedPath', () => {
  it('builds a shared path from multiple fields and encodes each dynamic segment', () => {
    expect(
      buildPublishedPath(
        { path: '/articles/[category]/[slug]' },
        { category: 'Science & Tech', slug: 'a/b' },
        'en'
      )
    ).toBe('/articles/Science%20%26%20Tech/a%2Fb')
  })

  it('applies explicit locale prefixes to shared and locale-specific templates', () => {
    const prefixes = { pl: '', en: '/en', de: '/de' }
    const doc = { slug: 'new' }

    expect(buildPublishedPath({ path: '/[slug]' }, doc, 'en', prefixes)).toBe('/en/new')
    expect(
      buildPublishedPath(
        { paths: { pl: '/realizacje/[slug]', en: '/work/[slug]', de: '/projekte/[slug]' } },
        doc,
        'pl',
        prefixes
      )
    ).toBe('/realizacje/new')
    expect(buildPublishedPath({ path: '/[slug]' }, doc, 'en')).toBe('/new')
  })

  it('does not prefix custom paths or infer a locale prefix', () => {
    expect(
      buildPublishedPath(
        {
          getPath: ({ doc, locale }: { doc: Record<string, unknown>; locale: unknown }) =>
            `/${String(doc.slug)}-${String(locale)}`,
        },
        { slug: 'new' },
        'en',
        { en: '/en' }
      )
    ).toBe('/new-en')
  })

  it('does not fall back when the requested locale has no path value', () => {
    expect(
      buildPublishedPath({ path: '/[slug]' }, { slug: { en: 'english' } }, 'pl', {
        pl: '',
        en: '/en',
      })
    ).toBeNull()
    expect(buildPublishedPath({ paths: { en: '/[slug]' } }, { slug: 'x' }, 'pl')).toBeNull()
  })

  it('returns null for missing values and unsafe or invalid callback results', () => {
    expect(buildPublishedPath({ path: '/articles/[slug]' }, {}, 'en')).toBeNull()
    expect(buildPublishedPath({ path: '//external/[slug]' }, { slug: 'x' }, 'en')).toBeNull()
    expect(buildPublishedPath({ getPath: () => '//external/path' }, {}, 'en')).toBeNull()
    expect(buildPublishedPath({ getPath: () => undefined }, {}, 'en')).toBeNull()
  })

  it('supports non-localized collections without a locale', () => {
    expect(buildPublishedPath({ path: '/articles/[slug]' }, { slug: 'x' }, null)).toBe(
      '/articles/x'
    )
    expect(
      buildPublishedPath(
        {
          getPath: ({ locale }: { doc: Record<string, unknown>; locale: unknown }) =>
            locale ? `/${String(locale)}/articles` : '/articles',
        },
        {},
        undefined
      )
    ).toBe('/articles')
  })
})

describe('path configuration validation', () => {
  it('accepts only safe site-relative templates and prefixes', () => {
    expect(isValidPathTemplate('/articles/[slug]')).toBe(true)
    expect(isValidPathTemplate('/articles/[slug]/[category]')).toBe(true)
    expect(isValidPathTemplate('https://example.com/[slug]')).toBe(false)
    expect(isValidPathTemplate('/articles/[[...slug]]')).toBe(false)
    expect(isValidPathTemplate('/articles/[bad-name]')).toBe(false)
    expect(isValidLocalePrefix('')).toBe(true)
    expect(isValidLocalePrefix('/en')).toBe(true)
    expect(isValidLocalePrefix('//example.com')).toBe(false)
  })
})
