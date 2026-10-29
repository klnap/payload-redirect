import type { Payload, PayloadRequest, SelectType, Where } from 'payload'
import type { RedirectStatusCode } from '#redirect/core/redirects/model/status-code'

/** Fields loaded by `resolveRedirect` (omit description). */
export const redirectResolveSelect = {
  from: true,
  to: true,
  StatusCode: true,
  enabled: true,
} as const

/** Lookup hooks / idempotent writes (includes `id`). */
export const redirectLookupSelect = {
  id: true,
  ...redirectResolveSelect,
  origin: true,
} as const

export type RedirectLookupDoc = {
  id: string | number
  from?: string | null
  to?: string | null
  StatusCode?: RedirectStatusCode | null
  enabled?: boolean | null
  origin?: string | null
}

type FindByFromBase = {
  collectionSlug: string
  from: string
  req?: PayloadRequest
  overrideAccess?: boolean
  context?: Record<string, unknown>
  select?: SelectType
}

export const findRedirectByFrom = async (
  payload: Payload,
  {
    collectionSlug,
    from,
    req,
    overrideAccess = false,
    context,
    select = redirectLookupSelect,
    excludeId,
  }: FindByFromBase & { excludeId?: string | number }
) => {
  const where: Where = excludeId
    ? {
        and: [{ from: { equals: from } }, { id: { not_equals: excludeId } }],
      }
    : { from: { equals: from } }

  return payload.find({
    collection: collectionSlug,
    where,
    limit: 1,
    depth: 0,
    select,
    overrideAccess,
    context,
    req,
  })
}
