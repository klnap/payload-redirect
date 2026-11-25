import type { PublishedLinkWire } from '#redirect/core/redirects/auto/published-link-config'

/** Shape for `CollectionConfig.custom.redirect` — auto redirect on identifier change. */
export type RedirectIdentifierField = string

export type PayloadRedirectCustom = {
  enabled?: boolean
  identifier: RedirectIdentifierField
  publishedLink?: PublishedLinkWire
}

const REDIRECT_CUSTOM_KEY = 'redirect' as const

export function readRedirectCustom(custom: unknown): PayloadRedirectCustom | null {
  if (!custom || typeof custom !== 'object') return null
  const entry = (custom as Record<string, unknown>)[REDIRECT_CUSTOM_KEY]
  if (!entry || typeof entry !== 'object') return null
  const record = entry as Record<string, unknown>
  if (record.enabled === false) return null
  const identifier = record.identifier
  if (typeof identifier !== 'string' || !identifier.trim()) return null
  return {
    enabled: record.enabled !== false,
    identifier: identifier.trim(),
  }
}
