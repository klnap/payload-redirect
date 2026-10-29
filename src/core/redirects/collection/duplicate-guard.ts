import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload'
import { ValidationError } from 'payload'
import { normalizePathOrUrl } from '#redirect/core/redirects/normalize-path'
import { findRedirectByFrom } from '#redirect/core/redirects/queries'
import { getRedirectRuntime } from '#redirect/core/redirects/runtime'

const DUPLICATE_MESSAGE = 'A redirect rule already exists for this source path'

export const resolveNormalizedFrom = (data: Record<string, unknown>): string | undefined => {
  const raw = data.from
  if (typeof raw !== 'string' || raw.trim().length === 0) return undefined
  try {
    return normalizePathOrUrl(raw)
  } catch {
    return undefined
  }
}

export const findDuplicateFrom = async ({
  req,
  collectionSlug,
  normalizedFrom,
  excludeId,
}: {
  req: PayloadRequest
  collectionSlug: string
  normalizedFrom: string
  excludeId?: string | number
}): Promise<boolean> => {
  const result = await findRedirectByFrom(req.payload, {
    collectionSlug,
    from: normalizedFrom,
    excludeId,
    req,
    overrideAccess: false,
    select: { id: true },
  })

  return result.docs.length > 0
}

type HookOperationArgs = {
  data: Record<string, unknown> | undefined
  req: PayloadRequest
  operation: string
  originalDoc?: { id?: string | number } | null
}

/** Payload collection `beforeChange` passes `originalDoc`, not top-level `id` (see Payload 3 update op). */
export const resolveDuplicateGuardExcludeId = (
  operation: string,
  originalDoc?: { id?: string | number } | null
): string | number | undefined => {
  if (operation !== 'update' || !originalDoc) return undefined
  const { id } = originalDoc
  if (typeof id === 'string' || typeof id === 'number') return id
  return undefined
}

const resolveExcludeId = (args: HookOperationArgs): string | number | undefined =>
  resolveDuplicateGuardExcludeId(args.operation, args.originalDoc)

const assertNoDuplicateFrom = async (args: HookOperationArgs): Promise<string | undefined> => {
  const { data, req } = args
  if (!data) return undefined

  const normalizedFrom = resolveNormalizedFrom(data)
  if (!normalizedFrom) return undefined

  const { collectionSlug } = getRedirectRuntime(req.payload.config)
  const duplicate = await findDuplicateFrom({
    req,
    collectionSlug,
    normalizedFrom,
    excludeId: resolveExcludeId(args),
  })

  if (duplicate) {
    throw new ValidationError({ errors: [{ message: DUPLICATE_MESSAGE, path: 'from' }] })
  }

  return normalizedFrom
}

export const createDuplicateBeforeChange = (): CollectionBeforeChangeHook => {
  return async (args) => {
    const { data, req, operation } = args
    const normalizedFrom = await assertNoDuplicateFrom({
      data: data as Record<string, unknown> | undefined,
      req,
      operation,
      originalDoc: args.originalDoc,
    })

    if (data && normalizedFrom && typeof data.from === 'string') {
      data.from = normalizedFrom
    }

    return data
  }
}
