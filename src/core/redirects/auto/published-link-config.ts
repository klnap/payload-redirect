import type { PreviewRoutes } from '#redirect/core/url/preview-routes'
import type { LocalePrefix, PublishedLinkPathTemplate } from '#redirect/core/url/published-path'
import type { RouteParamsConfig } from '#redirect/core/url/route-params'

export type PublishedLinkWire = PublishedLinkPathTemplate & {
  localePrefix?: LocalePrefix
}

const REDIRECT_CUSTOM_KEY = 'redirect' as const
const DRAFT_CUSTOM_KEY = 'draft' as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parsePublishedLinkWire = (value: unknown): PublishedLinkWire | null => {
  if (!isRecord(value)) return null
  const wire: PublishedLinkWire = {}
  if (typeof value.path === 'string' && value.path.length > 0) {
    wire.path = value.path
  }
  if (isRecord(value.paths) && Object.keys(value.paths).length > 0) {
    wire.paths = value.paths as Record<string, string>
  }
  if (isRecord(value.routes) && Object.keys(value.routes).length > 0) {
    wire.routes = value.routes as PreviewRoutes
  }
  if (isRecord(value.params) && Object.keys(value.params).length > 0) {
    wire.params = value.params as RouteParamsConfig
  }
  if (isRecord(value.localePrefix) && Object.keys(value.localePrefix).length > 0) {
    wire.localePrefix = value.localePrefix as LocalePrefix
  }
  const hasTemplate =
    Boolean(wire.path) ||
    Boolean(wire.paths && Object.keys(wire.paths).length > 0) ||
    Boolean(wire.routes && Object.keys(wire.routes).length > 0)
  return hasTemplate ? wire : null
}

const readDraftPublishedLink = (custom: unknown): PublishedLinkWire | null => {
  if (!isRecord(custom)) return null
  const entry = custom[DRAFT_CUSTOM_KEY]
  if (!isRecord(entry)) return null
  if (entry.enabled === false) return null
  return parsePublishedLinkWire(entry.publishedLink)
}

const readRedirectPublishedLink = (custom: unknown): PublishedLinkWire | null => {
  if (!isRecord(custom)) return null
  const entry = custom[REDIRECT_CUSTOM_KEY]
  if (!isRecord(entry)) return null
  return parsePublishedLinkWire(entry.publishedLink)
}

/** Reads `custom.redirect.publishedLink`, then `custom.draft.publishedLink` (same wire shape). */
export function readPublishedLinkWire(custom: unknown): PublishedLinkWire | null {
  return readRedirectPublishedLink(custom) ?? readDraftPublishedLink(custom)
}
