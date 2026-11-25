import type { CollectionConfig } from 'payload'

import { readPublishedLinkWire } from '#redirect/core/redirects/auto/published-link-config'
import { paramKeyFromIdentifierPath } from '#redirect/core/redirects/identifier-field-path'
import { type LocalePrefix, resolvePublishedPathConfig } from '#redirect/core/url/published-path'
import { extractDynamicSegments } from '#redirect/core/url/route-params'

export function resolveCollectionPublishedPathConfig(
  collection: CollectionConfig,
  pluginLocalePrefix?: LocalePrefix
) {
  const link = readPublishedLinkWire(collection.custom)
  if (!link) return null

  const templates = [
    ...(typeof link.path === 'string' ? [link.path] : []),
    ...Object.values(link.paths ?? {}),
    ...Object.values(link.routes ?? {}).flatMap((route) =>
      typeof route === 'string' ? [route] : Object.values(route)
    ),
  ]
  const params = Object.fromEntries(
    [...new Set(templates.flatMap(extractDynamicSegments))].flatMap((name) => {
      const field = collection.fields.find(
        (candidate) => 'name' in candidate && candidate.name === name
      )
      return field && 'type' in field
        ? [[name, { field: name, localized: 'localized' in field && field.localized === true }]]
        : []
    })
  )

  return resolvePublishedPathConfig(pluginLocalePrefix, {
    ...link,
    params: { ...params, ...link.params },
  })
}

export function identifierValueForPath(identifier: string, value: string) {
  const key = paramKeyFromIdentifierPath(identifier)
  return { [key]: value }
}
