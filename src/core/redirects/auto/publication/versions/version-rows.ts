export type VersionRow = {
  id?: string | number
  updatedAt?: string
  snapshot?: boolean
  autosave?: boolean
  publishedLocale?: string
  published_locale?: string
  version?: Record<string, unknown>
}

export const isPublishedVersionRow = (
  row: VersionRow,
  locale: string,
  options?: { localizeStatus?: boolean; defaultLocale?: string; identifier?: string }
): boolean => {
  if (row.snapshot || row.autosave) return false

  const publishedLocale = row.publishedLocale ?? row.published_locale
  if (publishedLocale) {
    return publishedLocale === locale
  }

  const status = row.version?._status
  if (status === 'draft') return false

  if (options?.localizeStatus && options.identifier) {
    const field = row.version?.[options.identifier]
    if (typeof field === 'string') {
      if (typeof status === 'object' && status !== null) {
        return (status as Record<string, unknown>)[locale] === 'published'
      }
      return status === 'published'
    }
    if (field && typeof field === 'object' && !Array.isArray(field)) {
      if (!(locale in field)) return false
      if (typeof status === 'object' && status !== null) {
        return (status as Record<string, unknown>)[locale] === 'published'
      }
      if (status === 'published') return true
      return false
    }
  }

  if (status && typeof status === 'object') {
    return (status as Record<string, unknown>)[locale] === 'published'
  }

  if (status === 'published') {
    if (options?.localizeStatus && options.defaultLocale) {
      return locale === options.defaultLocale
    }
    return true
  }

  return false
}

export const pickPublishedVersions = (
  rows: VersionRow[],
  locale: string,
  options?: { localizeStatus?: boolean; defaultLocale?: string; identifier?: string }
): VersionRow[] => rows.filter((row) => isPublishedVersionRow(row, locale, options))
