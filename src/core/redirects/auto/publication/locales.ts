import type { CollectionConfig, PayloadRequest } from 'payload'
import { isIdentifierPathLocalized } from '#redirect/core/redirects/identifier-field-path'

export const listLocales = (req: PayloadRequest): string[] => {
  const localization = req.payload.config.localization
  if (!localization) return []
  return localization.locales.map((l) => (typeof l === 'string' ? l : l.code))
}

export const getRequestLocales = (req: PayloadRequest): string[] => {
  if (req.query?.publishAllLocales === 'true' || req.query?.publishAllLocales === true) {
    return listLocales(req)
  }
  const locale =
    (typeof req.query?.publishSpecificLocale === 'string' && req.query.publishSpecificLocale) ||
    (typeof req.query?.locale === 'string' && req.query.locale) ||
    (typeof req.locale === 'string' ? req.locale : undefined)
  if (locale && locale !== 'all') return [locale]

  const all = listLocales(req)
  if (all.length === 0) return ['en']

  return []
}

export const hasLocalizedDraftStatus = (collection: CollectionConfig): boolean => {
  const versions = collection.versions
  if (!versions || typeof versions !== 'object' || !('drafts' in versions)) return false
  const drafts = versions.drafts
  return typeof drafts === 'object' && drafts !== null && drafts.localizeStatus === true
}

export const isIdentifierLocalized = (
  collection: CollectionConfig,
  identifier: string
): boolean => {
  return isIdentifierPathLocalized(collection.fields, identifier)
}

export const resolveDefaultLocale = (req: PayloadRequest): string | undefined => {
  const localization = req.payload.config.localization
  if (typeof localization === 'object' && localization && 'defaultLocale' in localization) {
    return String(localization.defaultLocale)
  }
  return undefined
}
