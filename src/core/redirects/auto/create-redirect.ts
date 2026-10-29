import type { CollectionAfterChangeHook } from 'payload'
import { ensureAutoRedirect } from '#redirect/core/redirects/auto/persist-auto-rule'
import { getPublicationTransition } from '#redirect/core/redirects/auto/publication/get-publication-transition'
import { publicationTransitionsToPairs } from '#redirect/core/redirects/auto/publication/transitions-to-pairs'
import {
  identifierValueForPath,
  resolveCollectionPublishedPathConfig,
} from '#redirect/core/redirects/auto/published-path'
import { REDIRECT_CONTEXT_KEYS } from '#redirect/core/redirects/context-keys'
import { normalizePathOrUrl } from '#redirect/core/redirects/normalize-path'
import { getRedirectRuntime } from '#redirect/core/redirects/runtime'
import { buildPublishedPath } from '#redirect/core/url/published-path'

export type CreateRedirectOptions = {
  identifier: string
}

export const createRedirect =
  (options: CreateRedirectOptions): CollectionAfterChangeHook =>
  async (args) => {
    const { req, collection } = args

    if (req.context?.[REDIRECT_CONTEXT_KEYS.skipAuto]) {
      return args.doc
    }

    const transitions = await getPublicationTransition(args, options)
    const pairs = publicationTransitionsToPairs(transitions)
    if (pairs.length === 0) {
      return args.doc
    }

    const { collectionSlug, localePrefix } = getRedirectRuntime(req.payload.config)
    const pathConfig = resolveCollectionPublishedPathConfig(collection, localePrefix)

    for (const { previous, current, locale } of pairs) {
      const resolvePath = (identifierValue: string): string | null => {
        if (!pathConfig || !locale) return identifierValue
        const built = buildPublishedPath(
          pathConfig,
          identifierValueForPath(options.identifier, identifierValue),
          locale
        )
        return built
      }

      const fromRaw = resolvePath(previous)
      const toRaw = resolvePath(current)
      if (!fromRaw || !toRaw) {
        continue
      }

      let from: string
      let to: string
      try {
        from = normalizePathOrUrl(fromRaw)
        to = normalizePathOrUrl(toRaw)
      } catch {
        continue
      }

      if (from === to) {
        continue
      }

      await ensureAutoRedirect({
        req,
        collectionSlug,
        rule: { from, to },
        context: req.context,
      })
    }

    return args.doc
  }
