import type { CollectionAfterChangeHook } from 'payload'
import { ensureAutoRedirect } from '#redirect/core/redirects/auto/persist-auto-rule'
import { getPublicationTransition } from '#redirect/core/redirects/auto/publication/get-publication-transition'
import { REDIRECT_CONTEXT_KEYS } from '#redirect/core/redirects/context-keys'
import { normalizePathOrUrl } from '#redirect/core/redirects/normalize-path'
import { buildPublishedPath, type LocalePrefixes } from '#redirect/core/url/published-path'
import type { RedirectPathOptions } from './types.js'

type CreateRedirectOptions = {
  collectionSlug: string
  pathOptions: RedirectPathOptions
  localePrefixes?: LocalePrefixes
}

export const createRedirect =
  ({
    collectionSlug,
    pathOptions,
    localePrefixes,
  }: CreateRedirectOptions): CollectionAfterChangeHook =>
  async (args) => {
    if (pathOptions.enabled === false) return args.doc
    if (args.req.context?.[REDIRECT_CONTEXT_KEYS.skipAuto]) return args.doc

    const transitions = await getPublicationTransition(args)

    for (const { currentDoc, publishedDocs, locale } of transitions) {
      const currentPath = buildPublishedPath(pathOptions, currentDoc, locale, localePrefixes)
      if (!currentPath) continue

      const to = normalizePathOrUrl(currentPath)
      const [latestPublishedDoc, ...earlierPublishedDocs] = publishedDocs
      const latestPath = latestPublishedDoc
        ? buildPublishedPath(pathOptions, latestPublishedDoc, locale, localePrefixes)
        : null
      const previousPublishedDoc =
        latestPath && normalizePathOrUrl(latestPath) === to
          ? earlierPublishedDocs[0]
          : latestPublishedDoc
      if (!previousPublishedDoc) continue

      const previousPath = buildPublishedPath(
        pathOptions,
        previousPublishedDoc,
        locale,
        localePrefixes
      )
      if (!previousPath) continue

      const from = normalizePathOrUrl(previousPath)
      if (from === to) continue

      await ensureAutoRedirect({
        req: args.req,
        collectionSlug,
        rule: { from, to },
        context: args.req.context,
      })
    }

    return args.doc
  }
