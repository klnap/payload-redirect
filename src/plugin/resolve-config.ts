import type { CollectionConfig } from 'payload'
import type { RedirectsCollectionAccess } from '#redirect/core/redirects/collection/access'
import { createRedirectsCollection } from '#redirect/core/redirects/collection/collection'
import { RedirectConfigError } from '#redirect/core/redirects/model/errors'
import type { LocalePrefix } from '#redirect/core/url/published-path'
import { assertValidCollectionConfig } from './validate-config'

export type RedirectsPluginConfig = {
  localePrefix?: LocalePrefix
  /** Enable Payload trash (soft delete). Default true. */
  trash?: boolean
  /** Host-owned collection (register in `config.collections` and pass the same config here). */
  collection: CollectionConfig
  /** Access overrides when the host collection omits handlers (base collection wins). */
  access?: RedirectsCollectionAccess
}

export type ResolvedRedirectsPluginConfig = {
  localePrefix?: LocalePrefix
  collection: CollectionConfig
}

export const resolveRedirectsPluginConfig = (
  config?: RedirectsPluginConfig
): ResolvedRedirectsPluginConfig => {
  if (!config?.collection) {
    throw new RedirectConfigError(
      'redirects plugin requires `collection` — register a redirects CollectionConfig in config.collections and pass it to redirects({ collection })'
    )
  }

  const collectionOptions = {
    trash: config.trash,
    access: config.access,
  }

  const collection = assertValidCollectionConfig(config.collection)
  return {
    localePrefix: config.localePrefix,
    collection: createRedirectsCollection({
      base: collection,
      ...collectionOptions,
    }),
  }
}
