import { describe, expect, it } from 'bun:test'
import { isPublishedVersionRow } from './version-rows'

describe('isPublishedVersionRow', () => {
  it('excludes snapshots, autosaves, and drafts', () => {
    expect(isPublishedVersionRow({ snapshot: true, version: { _status: 'published' } }, 'en')).toBe(
      false
    )
    expect(isPublishedVersionRow({ autosave: true, version: { _status: 'published' } }, 'en')).toBe(
      false
    )
    expect(isPublishedVersionRow({ version: { _status: 'draft' } }, 'en')).toBe(false)
  })

  it('matches localized publication status only for the requested locale', () => {
    const row = { version: { _status: { en: 'published', pl: 'draft' } } }
    expect(isPublishedVersionRow(row, 'en')).toBe(true)
    expect(isPublishedVersionRow(row, 'pl')).toBe(false)
    expect(isPublishedVersionRow(row, undefined)).toBe(false)
  })

  it('accepts scalar published status for a locale-scoped version query', () => {
    const row = { version: { _status: 'published' } }
    expect(isPublishedVersionRow(row, 'pl', { localizeStatus: true, defaultLocale: 'pl' })).toBe(
      true
    )
    expect(isPublishedVersionRow(row, 'de', { localizeStatus: true, defaultLocale: 'pl' })).toBe(
      true
    )
    expect(
      isPublishedVersionRow(row, undefined, { localizeStatus: true, defaultLocale: 'pl' })
    ).toBe(false)
    expect(isPublishedVersionRow(row, 'en')).toBe(true)
  })
})
