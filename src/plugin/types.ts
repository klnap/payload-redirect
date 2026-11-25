import type { CollectionSlug, DataFromCollectionSlug, TypedLocale } from 'payload'
import type { RedirectCollectionOverrides } from '#redirect/core/redirects/collection/types'

type Locales = Extract<TypedLocale, string>

export type RedirectLocaleMap = [Locales] extends [never]
  ? Record<never, never>
  : { [Locale in Locales]: string }

type PathModes<TSlug extends CollectionSlug> =
  | { path: string; paths?: never; getPath?: never }
  | { path?: never; paths: RedirectLocaleMap; getPath?: never }
  | {
      path?: never
      paths?: never
      getPath: (args: { doc: DataFromCollectionSlug<TSlug>; locale: TypedLocale }) => string | null
    }

type DisabledPathModes<TSlug extends CollectionSlug> = Partial<PathModes<TSlug>>

export type RedirectCollectionOptions<TSlug extends CollectionSlug> =
  | ({ identifier: string; enabled?: true } & PathModes<TSlug>)
  | ({ identifier?: string; enabled: false } & DisabledPathModes<TSlug>)

export type RedirectsOptions = {
  /** Master switch for automatic redirect generation. Manual redirect management stays enabled. */
  enabled?: boolean
  /** Host URL prefixes. Payload's localization config remains the locale source of truth. */
  localePrefix?: RedirectLocaleMap
  /** Centralized per-collection automatic redirect configuration. */
  collections?: {
    [TSlug in CollectionSlug]?: RedirectCollectionOptions<TSlug>
  }
  /** Native collection overrides for the plugin-owned redirects collection. */
  overrides?: RedirectCollectionOverrides
}
