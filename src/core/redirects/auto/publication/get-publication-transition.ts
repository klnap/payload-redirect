import type { CollectionAfterChangeHook } from 'payload'
import { REDIRECT_CONTEXT_KEYS } from '#redirect/core/redirects/context-keys'
import type { PublicationTransition } from '../types.js'
import { getRequestLocales, hasLocalizedDraftStatus, resolveDefaultLocale } from './locales.js'
import { isDraftSave, isLocalePublished } from './publish-intent.js'
import { fetchLocalePublishedDoc } from './versions/document-locale.js'
import { fetchPublishedVersionPages } from './versions/version-pages.js'

export const getPublicationTransition = async (
  args: Parameters<CollectionAfterChangeHook>[0]
): Promise<PublicationTransition[]> => {
  const { req, doc, collection } = args
  if (!collection.versions?.drafts) return []
  if (isDraftSave(req) || req.context?.[REDIRECT_CONTEXT_KEYS.skipAuto]) return []

  const docId = doc.id
  const locales = getRequestLocales(req, (doc as Record<string, unknown>)._status)
  const localizeStatus = hasLocalizedDraftStatus(collection)
  const defaultLocale = resolveDefaultLocale(req)
  const transitions: PublicationTransition[] = []

  for (const locale of locales) {
    const currentDoc = await fetchLocalePublishedDoc({ req, collection, docId, locale })
    if (!currentDoc || !isLocalePublished(currentDoc._status, locale ?? '')) continue

    const publishedDocs = (
      await fetchPublishedVersionPages({
        req,
        collectionSlug: collection.slug,
        docId,
        locale,
        versionFilter: { localizeStatus, defaultLocale },
      })
    )
      .map((row) => row.version)
      .filter((version): version is Record<string, unknown> => Boolean(version))

    transitions.push({ locale, currentDoc, publishedDocs })
  }

  return transitions
}
