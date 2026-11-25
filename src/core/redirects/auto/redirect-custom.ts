import { type PublishedLinkWire, readPublishedLinkWire } from './published-link-config.js'

export type PayloadRedirectCustom = {
  enabled?: boolean
  identifier: string
  publishedLink?: PublishedLinkWire
}

export function readRedirectCustom(custom: unknown): PayloadRedirectCustom | null {
  if (!custom || typeof custom !== 'object' || Array.isArray(custom)) return null
  const entry = (custom as Record<string, unknown>).redirect
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
  const record = entry as Record<string, unknown>
  if (record.enabled === false) return null
  if (typeof record.identifier !== 'string' || !record.identifier.trim()) return null
  const publishedLink = readPublishedLinkWire({ redirect: record }) ?? undefined
  return {
    enabled: record.enabled !== false,
    identifier: record.identifier.trim(),
    ...(publishedLink ? { publishedLink } : {}),
  }
}
