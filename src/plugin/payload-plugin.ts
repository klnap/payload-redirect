import { type CollectionConfig, type Config, definePlugin, type Plugin } from 'payload'
import { createRedirect } from '#redirect/core/redirects/auto/create-redirect'
import { readRedirectCustom } from '#redirect/core/redirects/auto/redirect-custom'
import { createRedirectsCollection } from '#redirect/core/redirects/collection/collection'
import { registerRedirectRuntime } from '#redirect/core/redirects/runtime'
import type { RedirectsOptions } from './types.js'

const PLUGIN_SLUG = '@klnap/payload-redirect'
const DEFAULT_COLLECTION_SLUG = 'redirects'

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined

const localeCodes = (config: Config): string[] => {
  const locales = config.localization === false ? undefined : config.localization?.locales
  return Array.isArray(locales)
    ? locales.map((locale) =>
        typeof locale === 'string' ? locale : (locale as { code: string }).code
      )
    : []
}

const assertLocaleMap = (
  value: unknown,
  locales: string[],
  name: string
): Record<string, string> => {
  const map = asRecord(value)
  if (!map) throw new Error(`payload-redirect: ${name} must be a locale map`)
  const missing = locales.filter((locale) => !(locale in map))
  const unknown = locales.length
    ? Object.keys(map).filter((locale) => !locales.includes(locale))
    : []
  if (missing.length || unknown.length) {
    throw new Error(
      `payload-redirect: ${name} has invalid locales (missing: ${missing.join(', ') || 'none'}; unknown: ${unknown.join(', ') || 'none'})`
    )
  }
  for (const [locale, path] of Object.entries(map)) {
    if (typeof path !== 'string') {
      throw new Error(`payload-redirect: ${name}.${locale} must be a string`)
    }
  }
  return map as Record<string, string>
}

const validateOptions = (config: Config, options: RedirectsOptions): void => {
  const locales = localeCodes(config)
  if (options.localePrefix !== undefined) {
    const prefixes = assertLocaleMap(options.localePrefix, locales, 'localePrefix')
    for (const [locale, prefix] of Object.entries(prefixes)) {
      if (
        prefix !== '' &&
        (!prefix.startsWith('/') ||
          prefix.startsWith('//') ||
          prefix.includes('?') ||
          prefix.includes('#') ||
          prefix.includes('\\') ||
          [...prefix].some((character) => {
            const code = character.charCodeAt(0)
            return code < 32 || code === 127
          }))
      ) {
        throw new Error(`payload-redirect: localePrefix.${locale} must be a site-relative path`)
      }
    }
  }

  for (const [slug, collectionOptions] of Object.entries(options.collections ?? {})) {
    if (!collectionOptions) continue
    if (!config.collections?.some((collection: CollectionConfig) => collection.slug === slug)) {
      throw new Error(`payload-redirect: configured collection "${slug}" is not registered`)
    }
    const modes = ['path', 'paths', 'getPath'].filter((key) => key in collectionOptions)
    if (collectionOptions.enabled !== false && modes.length !== 1) {
      throw new Error(
        `payload-redirect: collection "${slug}" must configure exactly one of path, paths, or getPath`
      )
    }
    if (collectionOptions.enabled === false) continue
    if ('path' in collectionOptions) {
      if (typeof collectionOptions.path !== 'string' || !collectionOptions.path.startsWith('/')) {
        throw new Error(`payload-redirect: collection "${slug}" path must start with "/"`)
      }
    }
    if ('paths' in collectionOptions) {
      if (locales.length === 0) {
        throw new Error(
          `payload-redirect: collection "${slug}" paths requires Payload localization`
        )
      }
      const paths = assertLocaleMap(collectionOptions.paths, locales, `collections.${slug}.paths`)
      for (const [locale, path] of Object.entries(paths)) {
        if (!path.startsWith('/')) {
          throw new Error(
            `payload-redirect: collections.${slug}.paths.${locale} must start with "/"`
          )
        }
      }
    }
    if ('getPath' in collectionOptions && typeof collectionOptions.getPath !== 'function') {
      throw new Error(`payload-redirect: collection "${slug}" getPath must be a function`)
    }
  }
}

const wireCollectionRedirect = (
  collection: CollectionConfig,
  options: RedirectsOptions
): CollectionConfig => {
  if (options.enabled === false) return collection

  const custom = asRecord(collection.custom)
  const redirect = asRecord(custom?.redirect)
  const central =
    options.collections?.[collection.slug as keyof NonNullable<RedirectsOptions['collections']>]
  const redirectOptions = readRedirectCustom(custom)
  const identifier = central?.identifier ?? redirectOptions?.identifier
  if (typeof identifier !== 'string' || !identifier.trim()) return collection
  if (central?.enabled === false || redirect?.enabled === false) return collection

  const publishedLink = {
    ...(central?.path !== undefined ? { path: central.path } : {}),
    ...(central?.paths !== undefined ? { paths: central.paths } : {}),
    ...(central?.getPath !== undefined ? { getPath: central.getPath } : {}),
    ...asRecord(redirect?.publishedLink),
  }
  const redirectConfig = {
    ...redirect,
    identifier: identifier.trim(),
    publishedLink: Object.keys(publishedLink).length > 0 ? publishedLink : redirect?.publishedLink,
  }
  const afterChange = collection.hooks?.afterChange
  const hooks = Array.isArray(afterChange) ? afterChange : afterChange ? [afterChange] : []
  const hook = createRedirect({ identifier: identifier.trim() })

  return {
    ...collection,
    custom: { ...custom, redirect: redirectConfig },
    hooks: {
      ...collection.hooks,
      afterChange: [...hooks, hook],
    },
  }
}

const definedRedirectsPlugin = definePlugin<RedirectsOptions>({
  slug: PLUGIN_SLUG,
  plugin: ({ config, ...options }) => {
    validateOptions(config, options)
    const registeredCount =
      config.plugins?.filter((plugin) => plugin.slug === PLUGIN_SLUG).length ?? 0
    if (registeredCount > 1) {
      throw new Error('payload-redirect: register redirects() only once in config.plugins')
    }
    if (Object.hasOwn(asRecord(config.custom) ?? {}, 'payloadRedirect')) {
      throw new Error('payload-redirect: config.custom.payloadRedirect is reserved')
    }

    const redirectsCollection = createRedirectsCollection(options.overrides)
    const collectionSlug = redirectsCollection.slug || DEFAULT_COLLECTION_SLUG
    const existing = config.collections?.find(({ slug }) => slug === collectionSlug)
    if (existing) {
      throw new Error(
        `payload-redirect: collection slug "${collectionSlug}" is already registered; configure it with redirects({ overrides: { slug } }) instead of defining a host collection`
      )
    }

    return {
      ...config,
      custom: registerRedirectRuntime(config, {
        collectionSlug,
        localePrefix: options.localePrefix,
      }),
      collections: [
        ...(config.collections ?? []).map((collection) =>
          wireCollectionRedirect(collection, options)
        ),
        redirectsCollection,
      ],
    }
  },
})

export const redirects = (options: RedirectsOptions = {}): Plugin => definedRedirectsPlugin(options)

export type { RedirectsOptions } from './types.js'
