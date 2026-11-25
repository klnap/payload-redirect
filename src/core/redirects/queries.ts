import type { CollectionSlug, Payload, PayloadRequest, SelectType, Where } from 'payload'
import type { RedirectStatusCode } from '#redirect/core/redirects/model/status-code'

/** Lookup hooks / idempotent writes (includes `id`). */
const redirectLookupSelect = {
  id: true,
  from: true,
  to: true,
  statusCode: true,
  enabled: true,
  origin: true,
} as const

export type RedirectLookupDoc = {
  id: string | number
  from?: string | null
  to?: string | null
  statusCode?: RedirectStatusCode | null
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
): Promise<{ docs: RedirectLookupDoc[] }> => {
  const where: Where =
    excludeId !== undefined
      ? {
          and: [{ from: { equals: from } }, { id: { not_equals: excludeId } }],
        }
      : { from: { equals: from } }

  return (await payload.find({
    collection: collectionSlug as CollectionSlug,
    where,
    limit: 1,
    depth: 0,
    select,
    overrideAccess,
    context,
    req,
  })) as unknown as { docs: RedirectLookupDoc[] }
}
