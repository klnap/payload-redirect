import { describe, expect, it } from 'bun:test'
import { pickPublishedVersions } from '#redirect/core/redirects/auto/publication/versions/version-rows'
import { isPublishedVersionRow } from './version-rows'

describe('published-state helpers', () => {
  it('filters autosave and draft versions', () => {
    const rows = pickPublishedVersions(
      [
        { autosave: true, version: { _status: 'published', slug: '/a' } },
        { version: { _status: 'draft', slug: '/b' } },
        { version: { _status: 'published', slug: '/c' } },
      ],
      'en'
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.version?.slug).toBe('/c')
  })

  it('localized published status per locale', () => {
    const rows = pickPublishedVersions(
      [{ version: { _status: { en: 'published', pl: 'draft' }, slug: '/x' } }],
      'en'
    )
    expect(rows).toHaveLength(1)
    expect(
      pickPublishedVersions([{ version: { _status: { en: 'draft', pl: 'published' } } }], 'en')
    ).toHaveLength(0)
  })

  it('filters unpublished, snapshot, autosave, and locale-mismatched rows', () => {
    expect(isPublishedVersionRow({ snapshot: true, version: { _status: 'published' } }, 'en')).toBe(
      false
    )
    expect(isPublishedVersionRow({ autosave: true, version: { _status: 'published' } }, 'en')).toBe(
      false
    )
    expect(isPublishedVersionRow({ publishedLocale: 'fr' }, 'en')).toBe(false)
    expect(isPublishedVersionRow({ published_locale: 'en' }, 'en')).toBe(true)
    expect(isPublishedVersionRow({ version: { _status: 'draft' } }, 'en')).toBe(false)
    expect(isPublishedVersionRow({ version: { _status: { fr: 'published' } } }, 'en')).toBe(false)
    expect(isPublishedVersionRow({ version: { _status: 'other' } }, 'en')).toBe(false)
  })

  it('handles localized identifier values and default-locale rules', () => {
    const localized = { localizeStatus: true, defaultLocale: 'en', identifier: 'slug' }
    expect(
      isPublishedVersionRow(
        { version: { _status: { en: 'published' }, slug: 'plain' } },
        'en',
        localized
      )
    ).toBe(true)
    expect(
      isPublishedVersionRow(
        { version: { _status: { en: 'draft' }, slug: 'plain' } },
        'en',
        localized
      )
    ).toBe(false)
    expect(
      isPublishedVersionRow(
        { version: { _status: 'published', slug: { en: 'plain' } } },
        'en',
        localized
      )
    ).toBe(true)
    expect(
      isPublishedVersionRow(
        { version: { _status: 'published', slug: { fr: 'plain' } } },
        'en',
        localized
      )
    ).toBe(false)
    expect(
      isPublishedVersionRow(
        { version: { _status: 'archived', slug: { en: 'plain' } } },
        'en',
        localized
      )
    ).toBe(false)
    expect(isPublishedVersionRow({ version: { _status: 'published' } }, 'fr', localized)).toBe(
      false
    )
    expect(
      isPublishedVersionRow({ version: { _status: 'published' } }, 'fr', { localizeStatus: true })
    ).toBe(true)
    expect(
      pickPublishedVersions(
        [{ version: { _status: 'published' } }, { version: { _status: 'draft' } }],
        'en'
      )
    ).toHaveLength(1)
  })
})
