import type { PayloadRequest } from 'payload'

const listLocales = (req: PayloadRequest): string[] => {
  const localization = req.payload.config.localization
  if (localization === false || !localization) return []
  return localization.locales.map((locale) => (typeof locale === 'string' ? locale : locale.code))
}

export const getRequestLocales = (
  req: PayloadRequest,
  status: unknown
): Array<string | undefined> => {
  const localization = listLocales(req)
  if (localization.length === 0) return [undefined]

  const requested =
    (typeof req.query?.publishSpecificLocale === 'string' && req.query.publishSpecificLocale) ||
    (typeof req.query?.locale === 'string' && req.query.locale)
  if (requested && requested !== 'all') return [requested]

  if (
    requested === 'all' ||
    req.query?.publishAllLocales === 'true' ||
    req.query?.publishAllLocales === true
  ) {
    return localization
  }

  if (typeof req.locale === 'string') return [req.locale]

  if (status && typeof status === 'object' && !Array.isArray(status)) {
    return Object.entries(status as Record<string, unknown>)
      .filter(([, value]) => value === 'published')
      .map(([locale]) => locale)
  }

  return status === 'published' ? localization : []
}

export const hasLocalizedDraftStatus = (collection: {
  versions?: { drafts?: unknown } | false
}): boolean => {
  const drafts = collection.versions === false ? undefined : collection.versions?.drafts
  return Boolean(
    drafts && typeof drafts === 'object' && 'localizeStatus' in drafts && drafts.localizeStatus
  )
}

export const resolveDefaultLocale = (req: PayloadRequest): string | undefined => {
  const localization = req.payload.config.localization
  return localization ? localization.defaultLocale : undefined
}
