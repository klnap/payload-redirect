import { describe, expect, it } from 'bun:test'
import { pickPublishedVersions } from '#redirect/core/redirects/auto/publication/versions/version-rows'

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
})
