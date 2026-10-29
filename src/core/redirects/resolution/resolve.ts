import type { Payload } from 'payload'
import { RedirectAmbiguousRuleError } from '#redirect/core/redirects/model/errors'
import type { RedirectStatusCode } from '#redirect/core/redirects/model/status-code'
import { normalizePathOrUrl } from '#redirect/core/redirects/normalize-path'
import { findRedirectByFrom, redirectResolveSelect } from '#redirect/core/redirects/queries'
import type { ResolvedRedirect } from '#redirect/core/redirects/resolution/resolved'
import { toResolvedRedirect } from '#redirect/core/redirects/resolution/resolved'
import { getRedirectRuntime } from '#redirect/core/redirects/runtime'

export type ResolveRedirectArgs = {
  payload: Payload
  from: string
}

export const resolveRedirect = async ({
  payload,
  from,
}: ResolveRedirectArgs): Promise<ResolvedRedirect> => {
  const { collectionSlug } = getRedirectRuntime(payload.config)
  const normalizedFrom = normalizePathOrUrl(from)

  const result = await findRedirectByFrom(payload, {
    collectionSlug,
    from: normalizedFrom,
    overrideAccess: false,
    select: redirectResolveSelect,
  })

  if (result.totalDocs > 1) {
    throw new RedirectAmbiguousRuleError(
      `Multiple redirect rules exist for "${normalizedFrom}" (unique constraint should prevent this)`
    )
  }

  const doc = result.docs[0]
  if (!doc) return null

  return toResolvedRedirect({
    from: String(doc.from),
    to: doc.to as string | null | undefined,
    StatusCode: doc.StatusCode as RedirectStatusCode,
    enabled: doc.enabled !== false,
  })
}
