import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload'
import { ValidationError } from 'payload'
import { lockRedirectRuleGraph } from '#redirect/core/redirects/collection/graph-lock'
import {
  assertRedirectStatusCode,
  DEFAULT_REDIRECT_STATUS_CODE,
  validateDestinationForStatus,
} from '#redirect/core/redirects/model/status-code'
import {
  normalizeRedirectSourcePath,
  normalizeRelativeRedirectPath,
} from '#redirect/core/redirects/normalize-path'
import { findRedirectByFrom } from '#redirect/core/redirects/queries'
import { getRedirectRuntime } from '#redirect/core/redirects/runtime'

/** Enabled rules followed from `to` before a write is refused as unverifiable. Bounds the lookups per write. */
export const MAX_REDIRECT_CHAIN_HOPS = 1000

const DUPLICATE_MESSAGE = 'A redirect rule already exists for this source path'
const LOOP_MESSAGE =
  'Enabled redirect rules already lead from this destination back to this source path'
const CHAIN_LOOP_MESSAGE = 'Enabled redirect rules from this destination already contain a loop'
const CHAIN_TOO_LONG_MESSAGE = `Enabled redirect rules from this destination chain longer than ${MAX_REDIRECT_CHAIN_HOPS} hops`

const normalizeOrUndefined = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string' || raw.trim().length === 0) return undefined
  try {
    return normalizeRelativeRedirectPath(raw).split('#', 1)[0]
  } catch {
    return undefined
  }
}

export const resolveNormalizedFrom = (data: Record<string, unknown>): string | undefined => {
  if (typeof data.from !== 'string' || data.from.trim().length === 0) return undefined
  try {
    return normalizeRedirectSourcePath(data.from)
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
  // Integrity lookup: it must see every rule, whatever the requester can read. It returns only a boolean.
  const result = await findRedirectByFrom(req.payload, {
    collectionSlug,
    from: normalizedFrom,
    excludeId,
    req,
    overrideAccess: true,
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

/**
 * Rejects a write whose enabled chain from `to` returns to `from`, of any length. A chain that
 * repeats a hop without reaching `from` predates this write, so it is accepted. Runs past
 * MAX_REDIRECT_CHAIN_HOPS are refused as unverifiable. One indexed lookup on `from` per hop.
 */
const assertNoLoop = async (args: HookOperationArgs, normalizedFrom: string): Promise<void> => {
  const { data, req } = args
  if (!data || data.enabled === false) return

  const normalizedTo = normalizeOrUndefined(data.to)
  if (!normalizedTo) return
  if (normalizedTo === normalizedFrom) {
    throw new ValidationError({ errors: [{ message: LOOP_MESSAGE, path: 'to' }] })
  }

  const { collectionSlug } = getRedirectRuntime(req.payload.config)
  const excludeId = resolveExcludeId(args)
  const visited = new Set<string>()
  let current = normalizedTo
  for (let hop = 0; hop <= MAX_REDIRECT_CHAIN_HOPS; hop++) {
    if (visited.has(current)) {
      throw new ValidationError({ errors: [{ message: CHAIN_LOOP_MESSAGE, path: 'to' }] })
    }
    visited.add(current)
    // Integrity lookup: a requester without read access must not hide a rule from the cycle walk.
    const { docs } = await findRedirectByFrom(req.payload, {
      collectionSlug,
      from: current,
      excludeId,
      req,
      overrideAccess: true,
    })

    const rule = docs[0]
    if (!rule?.enabled) return
    const next = normalizeOrUndefined(rule.to)
    if (!next) return
    if (next === normalizedFrom) {
      throw new ValidationError({ errors: [{ message: LOOP_MESSAGE, path: 'to' }] })
    }
    current = next
  }

  throw new ValidationError({ errors: [{ message: CHAIN_TOO_LONG_MESSAGE, path: 'to' }] })
}

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

  await assertNoLoop(args, normalizedFrom)

  return normalizedFrom
}

const normalizeRulePaths = (data: Record<string, unknown>): void => {
  const normalize = (value: unknown, path: 'from' | 'to'): string => {
    if (typeof value !== 'string') {
      throw new ValidationError({ errors: [{ message: `${path} is required`, path }] })
    }
    try {
      return normalizeRelativeRedirectPath(value)
    } catch (error) {
      const message = error instanceof Error ? error.message : `Invalid ${path} path`
      throw new ValidationError({ errors: [{ message, path }] })
    }
  }

  if (typeof data.from !== 'string') {
    throw new ValidationError({ errors: [{ message: 'from is required', path: 'from' }] })
  }
  try {
    data.from = normalizeRedirectSourcePath(data.from)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid from path'
    throw new ValidationError({ errors: [{ message, path: 'from' }] })
  }
  data.to = normalize(data.to, 'to')

  try {
    const statusCode = assertRedirectStatusCode(data.StatusCode ?? DEFAULT_REDIRECT_STATUS_CODE)
    validateDestinationForStatus(statusCode, data.to)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid redirect status or destination'
    throw new ValidationError({ errors: [{ message, path: 'to' }] })
  }
}

/**
 * The rule as it will be stored: on update, the stored document overlaid with the incoming change.
 * Payload passes only the incoming fields to beforeChange, so checking `data` alone would skip the
 * loop walk for any update that omits `from` or `to`.
 */
export const effectiveRuleData = (
  operation: string,
  data: Record<string, unknown> | undefined,
  originalDoc: Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined => {
  if (!data) return undefined
  if (operation !== 'update' || !originalDoc) return data
  return { ...originalDoc, ...data }
}

export const createDuplicateBeforeChange = (): CollectionBeforeChangeHook => {
  return async (args) => {
    const { data, req, operation, originalDoc } = args
    if (operation === 'create' || operation === 'update') {
      await lockRedirectRuleGraph(req)
    }
    const effective = effectiveRuleData(
      operation,
      data as Record<string, unknown> | undefined,
      originalDoc as Record<string, unknown> | null | undefined
    )
    if (effective && (operation === 'create' || operation === 'update')) {
      normalizeRulePaths(effective)
      if (data) {
        if (typeof data.from === 'string') data.from = effective.from
        if (typeof data.to === 'string') data.to = effective.to
      }
    }
    const normalizedFrom = await assertNoDuplicateFrom({
      data: effective,
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
