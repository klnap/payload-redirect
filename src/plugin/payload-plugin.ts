import type { CollectionConfig, Config, Plugin } from 'payload'
import { createRedirect } from '#redirect/core/redirects/auto/create-redirect'
import { registerRedirectRuntime } from '#redirect/core/redirects/runtime'
import { readRedirectCustom } from './redirect-custom'
import { type RedirectsPluginConfig, resolveRedirectsPluginConfig } from './resolve-config'

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
    const resolved = resolveRedirectsPluginConfig(pluginConfig)
    const collectionSlug = resolved.collection.slug

    const collections = (incoming.collections ?? []).map(wireCollectionRedirectHook)

    return {
      ...incoming,
      collections: replaceOrAppendCollection(collections, resolved.collection),
      custom: registerRedirectRuntime(incoming, {
        collectionSlug,
        localePrefix: resolved.localePrefix,
      }),
    }
  }
