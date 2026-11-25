import { describe, expect, it } from 'bun:test'
import {
  extractIdentifierFromVersionSnapshot,
  normalizeIdentifierValue,
} from './identifier-snapshot'
import {
  getRequestLocales,
  hasLocalizedDraftStatus,
  isIdentifierLocalized,
  listLocales,
  resolveDefaultLocale,
} from './locales'
import {
  isDraftSave,
  isLocalePublished,
  isPublishIntent,
  isUnpublishedStatus,
} from './publish-intent'
import { publicationTransitionsToPairs } from './transitions-to-pairs'

describe('publication helpers', () => {
  it('resolves configured, requested, and fallback locales', () => {
    const payload = {
      config: { localization: { locales: ['en', { code: 'fr' }], defaultLocale: 'en' } },
    }
    const req = { payload, query: {} } as never

    expect(listLocales(req)).toEqual(['en', 'fr'])
    expect(getRequestLocales(req)).toEqual([])
    expect(
      getRequestLocales({
        payload,
        locale: 'fr',
        query: {},
      } as never)
    ).toEqual(['fr'])
    expect(
      getRequestLocales({
        payload,
        query: { publishAllLocales: true },
      } as never)
    ).toEqual(['en', 'fr'])
    expect(resolveDefaultLocale(req)).toBe('en')
    expect(listLocales({ payload: { config: {} } } as never)).toEqual([])
    expect(getRequestLocales({ payload: { config: {} }, query: {} } as never)).toEqual(['en'])
    expect(resolveDefaultLocale({ payload: { config: {} } } as never)).toBeUndefined()
  })

  it('reads localized draft status and nested identifier localization', () => {
    expect(
      hasLocalizedDraftStatus({ versions: { drafts: { localizeStatus: true } } } as never)
    ).toBe(true)
    expect(hasLocalizedDraftStatus({ versions: { drafts: true } } as never)).toBe(false)
    expect(
      isIdentifierLocalized(
        {
          fields: [{ name: 'meta', type: 'group', fields: [{ name: 'slug', localized: true }] }],
        } as never,
        'meta.slug'
      )
    ).toBe(true)
  })

  it('detects draft and publication intent across scalar and localized statuses', () => {
    expect(isDraftSave({ query: { draft: true } } as never)).toBe(true)
    expect(isDraftSave({ query: {} } as never)).toBe(false)
    expect(isUnpublishedStatus('published')).toBe(false)
    expect(isUnpublishedStatus({ en: 'draft' })).toBe(true)
    expect(isUnpublishedStatus({ en: 'published' })).toBe(false)
    expect(isUnpublishedStatus('archived')).toBe(true)
    expect(isPublishIntent({ _status: { fr: 'published' } })).toBe(true)
    expect(isPublishIntent({ _status: 'draft' })).toBe(false)
    expect(isPublishIntent(null)).toBe(false)
    expect(isLocalePublished({ fr: 'published' }, 'fr', true)).toBe(true)
    expect(isLocalePublished('published', 'en', false)).toBe(true)
    expect(isLocalePublished('published', 'en', true)).toBe(false)
  })

  it('extracts and normalizes scalar and localized snapshot identifiers', () => {
    expect(normalizeIdentifierValue('/old path')).toBe('/old path')
    expect(normalizeIdentifierValue('plain')).toBe('plain')
    expect(extractIdentifierFromVersionSnapshot({ slug: ' /old ' }, 'slug', 'en', true, 'en')).toBe(
      '/old'
    )
    expect(
      extractIdentifierFromVersionSnapshot({ slug: 'old' }, 'slug', 'en', true, 'fr')
    ).toBeUndefined()
    expect(extractIdentifierFromVersionSnapshot({ slug: { en: 'new' } }, 'slug', 'en', true)).toBe(
      'new'
    )
    expect(
      extractIdentifierFromVersionSnapshot({ meta: { slug: 'new' } }, 'meta.slug', 'en', false)
    ).toBe('new')
    expect(extractIdentifierFromVersionSnapshot({}, 'slug', 'en', false)).toBeUndefined()
  })

  it('turns publication transitions into locale-aware redirect pairs', () => {
    expect(
      publicationTransitionsToPairs([
        { published: true, locale: 'en', previous: '/old', current: '/new' },
        { published: false },
        { published: true, previous: '/same', current: '/same' },
      ])
    ).toEqual([{ locale: 'en', previous: '/old', current: '/new' }])
  })
})
