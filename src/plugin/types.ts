import type { CollectionSlug } from "payload";
import type { RedirectPathOptions } from "#redirect/core/redirects/auto/types";
import type { RedirectCollectionOverrides } from "#redirect/core/redirects/collection/types";

type LocaleCode = Extract<import("payload").TypedLocale, string>;
type LocaleMap = string extends LocaleCode ? Record<string, string> : Record<LocaleCode, string>;

export type RedirectCollectionOptions<TSlug extends CollectionSlug = CollectionSlug> =
  RedirectPathOptions<TSlug>;

export type RedirectsOptions = {
  /** Payload locale codes map to explicit site-relative prefixes; omission means no prefix. */
  localePrefixes?: LocaleMap;
  /** Each entry opts that collection into automatic redirects. Central entries replace local config. */
  collections?: { [TSlug in CollectionSlug]?: RedirectCollectionOptions<TSlug> };
  /** Native collection overrides for the plugin-owned redirects collection. */
  overrides?: RedirectCollectionOverrides;
};
