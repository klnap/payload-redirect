import type { CollectionConfig } from 'payload'

import { readPublishedLinkWire } from '#redirect/core/redirects/auto/published-link-config'
import { paramKeyFromIdentifierPath } from '#redirect/core/redirects/identifier-field-path'
import { type LocalePrefix, resolvePublishedPathConfig } from '#redirect/core/url/published-path'

export function resolveCollectionPublishedPathConfig(
  collection: CollectionConfig,
  pluginLocalePrefix?: LocalePrefix
) {
  const link = readPublishedLinkWire(collection.custom)
  return resolvePublishedPathConfig(pluginLocalePrefix, link ?? undefined)
}

export function identifierValueForPath(identifier: string, value: string): Record<string, unknown> {
  const key = paramKeyFromIdentifierPath(identifier)
  return { [key]: value }
}
