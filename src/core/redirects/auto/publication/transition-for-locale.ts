import type { CollectionConfig, PayloadRequest } from 'payload'
import { identifierValueToString } from '#redirect/core/redirects/auto/publication/identifier-transitions'
import { fetchLocalePublishedDoc } from '#redirect/core/redirects/auto/publication/versions/document-locale'
import {
  fetchPublishedVersionPages,
  fetchVersionHistoryPages,
} from '#redirect/core/redirects/auto/publication/versions/version-pages'
import type { VersionRow } from '#redirect/core/redirects/auto/publication/versions/version-rows'
import type { PublicationTransition } from '../types'
import {
  extractIdentifierFromVersionSnapshot,
  normalizeIdentifierValue,
} from './identifier-snapshot'
import { hasLocalizedDraftStatus, resolveDefaultLocale } from './locales'
import { isLocalePublished } from './publish-intent'

export const transitionForLocale = async ({
  req,
  collection,
  docId,
  locale,
  identifier,
  localizedField,
  hookDoc,
  publishIntent,
}: {
  req: PayloadRequest
  collection: CollectionConfig
  docId: string | number
  locale: string
  identifier: string
  localizedField: boolean
  hookDoc: Record<string, unknown>
  publishIntent: boolean
}): Promise<PublicationTransition> => {
  const localizeStatus = hasLocalizedDraftStatus(collection)

  const publishedDoc = await fetchLocalePublishedDoc({
    req,
    collection,
    docId,
    locale,
  })

  const hookPublished = isLocalePublished(hookDoc._status, locale, localizeStatus)
  const docPublished =
    publishedDoc != null && isLocalePublished(publishedDoc._status, locale, localizeStatus)

  const identifierSource = publishedDoc ?? hookDoc

  const defaultLocale = resolveDefaultLocale(req)

  const useAllLocaleVersions = localizedField

  let publishedVersions = await fetchPublishedVersionPages({
    req,
    collectionSlug: collection.slug,
    docId,
    locale,
    versionLocale: useAllLocaleVersions ? undefined : locale,
    versionFilter: localizeStatus ? { localizeStatus: true, defaultLocale, identifier } : undefined,
  })

  if (localizedField && defaultLocale && locale !== defaultLocale && !publishIntent) {
    publishedVersions = publishedVersions.filter((row) => {
      const version = row.version
      if (!version) return false
      const rawField = version[identifier]
      if (typeof rawField === 'string') {
        return true
      }
      const slug = extractIdentifierFromVersionSnapshot(version, identifier, locale, true, locale)
      if (!slug) return false
      const defaultSlug = extractIdentifierFromVersionSnapshot(
        version,
        identifier,
        defaultLocale,
        true,
        locale
      )
      return slug !== defaultSlug
    })
  }

  const seenIdentifiers = new Set<string>()
  publishedVersions = publishedVersions.filter((row) => {
    const version = row.version
    if (!version) return false
    const value = extractIdentifierFromVersionSnapshot(
      version,
      identifier,
      locale,
      localizedField,
      locale
    )
    if (!value) return false
    if (seenIdentifiers.has(value)) return false
    seenIdentifiers.add(value)
    return true
  })

  if (publishedVersions.length === 0 && !publishIntent && !hookPublished && !docPublished) {
    return { published: false }
  }

  if (!publishIntent && !hookPublished && !docPublished && publishedVersions.length < 2) {
    return { published: false }
  }

  const draftDoc =
    publishIntent && localizedField
      ? await fetchLocalePublishedDoc({
          req,
          collection,
          docId,
          locale,
          draft: true,
        })
      : undefined

  const currentVersion = publishedVersions[0]?.version
  const current =
    (draftDoc
      ? extractIdentifierFromVersionSnapshot(draftDoc, identifier, locale, localizedField, locale)
      : undefined) ??
    extractIdentifierFromVersionSnapshot(hookDoc, identifier, locale, localizedField, locale) ??
    (currentVersion
      ? extractIdentifierFromVersionSnapshot(
          currentVersion,
          identifier,
          locale,
          localizedField,
          locale
        )
      : undefined) ??
    extractIdentifierFromVersionSnapshot(
      identifierSource,
      identifier,
      locale,
      localizedField,
      locale
    )
  if (!current) {
    return { published: true }
  }

  let defaultSlug: string | undefined
  if (localizedField && defaultLocale) {
    defaultSlug = extractIdentifierFromVersionSnapshot(
      hookDoc,
      identifier,
      defaultLocale,
      true,
      locale
    )
    if (!defaultSlug) {
      const defaultDoc = await fetchLocalePublishedDoc({
        req,
        collection,
        docId,
        locale: defaultLocale,
      })
      if (defaultDoc) {
        defaultSlug = extractIdentifierFromVersionSnapshot(
          defaultDoc,
          identifier,
          defaultLocale,
          true,
          defaultLocale
        )
      }
    }
  }

  let versionsForPrevious: VersionRow[] = [...publishedVersions]
  if (publishIntent && localizedField) {
    versionsForPrevious = await fetchVersionHistoryPages({
      req,
      collectionSlug: collection.slug,
      docId,
      versionLocale: locale,
    })
  }

  if (current) {
    const hasCurrentHead = versionsForPrevious.some((row) => {
      const version = row.version
      if (!version) return false
      return (
        extractIdentifierFromVersionSnapshot(
          version,
          identifier,
          locale,
          localizedField,
          locale
        ) === current
      )
    })
    if (!hasCurrentHead) {
      versionsForPrevious.unshift({ version: hookDoc })
    }
  }

  let previous: string | undefined
  for (const row of versionsForPrevious) {
    const version = row.version
    if (!version) continue
    if (localizedField) {
      const rawField = version[identifier]
      if (rawField && typeof rawField === 'object' && !Array.isArray(rawField)) {
        if (!(locale in rawField)) continue
      }
    }

    const candidate = extractIdentifierFromVersionSnapshot(
      version,
      identifier,
      locale,
      localizedField,
      locale
    )
    if (!candidate || candidate === current) continue
    if (
      localizedField &&
      defaultLocale &&
      locale !== defaultLocale &&
      defaultSlug &&
      candidate === defaultSlug
    ) {
      continue
    }
    previous = candidate
    break
  }

  if (!previous) {
    return { published: true }
  }

  if (localizedField && defaultLocale) {
    if (locale !== defaultLocale && defaultSlug && previous === defaultSlug) {
      return { published: true }
    }

    if (locale === defaultLocale) {
      const slugField = hookDoc[identifier]
      if (slugField && typeof slugField === 'object' && !Array.isArray(slugField)) {
        for (const [code, value] of Object.entries(slugField as Record<string, unknown>)) {
          if (code === locale) continue
          const other = identifierValueToString(value)
          if (other && normalizeIdentifierValue(other) === previous) {
            return { published: true }
          }
        }
      }
    }
  }

  return { published: true, locale, previous, current }
}
