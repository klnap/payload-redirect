import type { PayloadRequest } from 'payload'
import { isIdenticalAutoRule } from '#redirect/core/redirects/auto/match-existing-rule'
import { REDIRECT_CONTEXT_KEYS } from '#redirect/core/redirects/context-keys'
import { findRedirectByFrom, type RedirectLookupDoc } from '#redirect/core/redirects/queries'

export type AutoRedirectRule = {
  from: string
  to: string
}

export type EnsureAutoRedirectArgs = {
  req: PayloadRequest
  collectionSlug: string
  rule: AutoRedirectRule
  context?: Record<string, unknown>
}

/**
 * Idempotent create for auto 301 rules. One lookup by unique `from`.
 */
export const ensureAutoRedirect = async ({
  req,
  collectionSlug,
  rule,
  context,
}: EnsureAutoRedirectArgs): Promise<'created' | 'skipped' | 'updated'> => {
  const internalContext = {
    ...context,
    [REDIRECT_CONTEXT_KEYS.internal]: true,
    [REDIRECT_CONTEXT_KEYS.skipAuto]: true,
  }

  const data = {
    from: rule.from,
    to: rule.to,
    StatusCode: '301',
    enabled: true,
    origin: 'auto' as const,
  }

  const existing = await findRedirectByFrom(req.payload, {
    collectionSlug,
    from: rule.from,
    req,
    overrideAccess: false,
    context: internalContext,
  })

  const doc = existing.docs[0] as RedirectLookupDoc | undefined
  if (doc) {
    if (isIdenticalAutoRule(doc, rule)) {
      return 'skipped'
    }
    if (doc.origin === 'auto') {
      await req.payload.update({
        collection: collectionSlug,
        id: doc.id,
        data: {
          to: rule.to,
          StatusCode: '301',
          enabled: true,
        },
        context: internalContext,
        overrideAccess: false,
        req,
      })
      return 'updated'
    }
    return 'skipped'
  }

  await req.payload.create({
    collection: collectionSlug,
    data,
    context: internalContext,
    overrideAccess: false,
    req,
  })

  return 'created'
}
