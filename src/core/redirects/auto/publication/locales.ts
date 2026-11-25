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

  if (process.env.PAYLOAD_REDIRECT_DEBUG === '1') {
    process.stderr.write(
      `[DEBUG-locale-selection] ${JSON.stringify({
        reqLocale: req.locale,
        query: {
          publishSpecificLocale: req.query?.publishSpecificLocale,
          publishAllLocales: req.query?.publishAllLocales,
          locale: req.query?.locale,
        },
        status,
      })}\n`
    )
  }

  const specificLocale =
    typeof req.query?.publishSpecificLocale === 'string'
      ? req.query.publishSpecificLocale
      : undefined
  if (specificLocale && specificLocale !== 'all') return [specificLocale]

  if (
    specificLocale === 'all' ||
    req.query?.publishAllLocales === 'true' ||
    req.query?.publishAllLocales === true
  ) {
    return localization
  }

  const requestedLocale = typeof req.query?.locale === 'string' ? req.query.locale : undefined
  if (requestedLocale && requestedLocale !== 'all') return [requestedLocale]
  if (requestedLocale === 'all') return localization

  if (status && typeof status === 'object' && !Array.isArray(status)) {
    return Object.entries(status as Record<string, unknown>)
      .filter(([, value]) => value === 'published')
      .map(([locale]) => locale)
  }

  if (typeof req.locale === 'string') return [req.locale]

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
