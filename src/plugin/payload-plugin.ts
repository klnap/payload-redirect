import type { CollectionConfig, Config, Plugin } from 'payload'
import { createRedirect } from '#redirect/core/redirects/auto/create-redirect'
import { createRedirectsCollection } from '#redirect/core/redirects/collection/collection'
import {
  PAYLOAD_REDIRECT_CUSTOM_KEY,
  registerRedirectRuntime,
} from '#redirect/core/redirects/runtime'
import { readRedirectCustom } from './redirect-custom.js'
import { type RedirectsPluginConfig, resolveRedirectsPluginConfig } from './resolve-config.js'

const replaceOrAppendCollection = (
  collections: Config['collections'],
  collection: NonNullable<Config['collections']>[number]
): Config['collections'] => {
  const list = collections ?? []
  const index = list.findIndex((c) => c.slug === collection.slug)
  if (index === -1) return [...list, collection]
  const next = [...list]
  next[index] = collection
  return next
}

const appendHook = <T>(existing: T[] | T | undefined, hook: T): T[] => {
  if (!existing) return [hook]
  return Array.isArray(existing) ? [...existing, hook] : [existing, hook]
}

const wireCollectionRedirectHook = (collection: CollectionConfig): CollectionConfig => {
  const meta = readRedirectCustom(collection.custom)
  if (!meta) return collection

  return {
    ...collection,
    hooks: {
      ...collection.hooks,
      afterChange: appendHook(
        collection.hooks?.afterChange,
        createRedirect({ identifier: meta.identifier })
      ),
    },
  }
}

export const redirects =
  (pluginConfig: RedirectsPluginConfig): Plugin =>
  (incoming: Config): Config => {
    if (incoming.custom && PAYLOAD_REDIRECT_CUSTOM_KEY in incoming.custom) {
      throw new Error(
        `payload-redirect: config.custom.${PAYLOAD_REDIRECT_CUSTOM_KEY} is reserved; duplicate plugin installation is not supported`
      )
    }
    const resolved = resolveRedirectsPluginConfig(pluginConfig)
    const collectionSlug = resolved.collection.slug

    const collections = (incoming.collections ?? []).map(wireCollectionRedirectHook)
    const existingCollection = collections.find((collection) => collection.slug === collectionSlug)
    const redirectCollection = existingCollection
      ? createRedirectsCollection({
          base: existingCollection,
          trash: resolved.collection.trash,
          access: resolved.collection.access,
        })
      : resolved.collection

    return {
      ...incoming,
      collections: replaceOrAppendCollection(collections, redirectCollection),
      custom: registerRedirectRuntime(incoming, {
        collectionSlug,
        localePrefix: resolved.localePrefix,
      }),
    }
  }
