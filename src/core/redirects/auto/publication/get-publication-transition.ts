import type { CollectionAfterChangeHook } from 'payload'
import { REDIRECT_CONTEXT_KEYS } from '#redirect/core/redirects/context-keys'
import type { GetPublicationTransitionOptions, PublicationTransition } from '../types'
import {
  getRequestLocales,
  hasLocalizedDraftStatus,
  isIdentifierLocalized,
  listLocales,
} from './locales'
import { isDraftSave, isPublishIntent, isUnpublishedStatus } from './publish-intent'
import { transitionForLocale } from './transition-for-locale'

export const getPublicationTransition = async (
  args: Parameters<CollectionAfterChangeHook>[0],
  options: GetPublicationTransitionOptions
): Promise<PublicationTransition[]> => {
  const { req, doc, collection, data } = args
  const publishIntent = isPublishIntent(data)

  if (!collection.versions?.drafts) return []
  if (isDraftSave(req)) return []
  if (req.context?.[REDIRECT_CONTEXT_KEYS.skipAuto]) return []

  const docRecord = doc as Record<string, unknown>
  if (isUnpublishedStatus(docRecord._status) && !hasLocalizedDraftStatus(collection)) {
    return []
  }

  let locales = getRequestLocales(req)
  const localizedField = isIdentifierLocalized(collection, options.identifier)
  const docId = doc.id

  const publishAllLocales =
    req.query?.publishAllLocales === 'true' || req.query?.publishAllLocales === true

  if (locales.length === 0 && publishAllLocales) {
    locales = listLocales(req)
  }

  if (
    locales.length === 0 &&
    localizedField &&
    hasLocalizedDraftStatus(collection) &&
    docRecord._status &&
    typeof docRecord._status === 'object'
  ) {
    locales = Object.entries(docRecord._status as Record<string, unknown>)
      .filter(([, value]) => value === 'published')
      .map(([code]) => code)
  }

  const transitions: PublicationTransition[] = []

  for (const locale of locales) {
    const t = await transitionForLocale({
      req,
      collection,
      docId,
      locale,
      identifier: options.identifier,
      localizedField,
      hookDoc: docRecord,
      publishIntent,
    })
    transitions.push(t)
  }

  return transitions
}
