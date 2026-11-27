import {
  type CollectionConfig,
  type Config,
  type GlobalConfig,
  definePlugin,
  type Plugin,
} from "payload";
import { createGlobalRedirect } from "#redirect/core/redirects/auto/create-global-redirect";
import { createRedirect } from "#redirect/core/redirects/auto/create-redirect";
import { createRedirectsCollection } from "#redirect/core/redirects/collection/collection";
import { isValidLocalePrefix } from "#redirect/core/url/published-path";
import { isValidPathTemplate } from "#redirect/core/url/route-params";
import type {
  RedirectCollectionOptions,
  RedirectGlobalOptions,
  RedirectsOptions,
} from "./types.js";

const PLUGIN_SLUG = "@klnap/payload-redirect";
const DEFAULT_COLLECTION_SLUG = "redirects";
const PATH_OPTIONS = new Set(["enabled", "path", "paths", "getPath"]);

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const localeCodes = (config: Config): string[] => {
  const locales = config.localization === false ? undefined : config.localization?.locales;
  return Array.isArray(locales)
    ? locales.map((locale) =>
        typeof locale === "string" ? locale : (locale as { code: string }).code,
      )
    : [];
};

const assertLocaleMap = (
  value: unknown,
  locales: string[],
  name: string,
): Record<string, string> => {
  const map = asRecord(value);
  if (!map) throw new Error(`payload-redirect: ${name} must be a locale map`);
  const missing = locales.filter((locale) => !Object.hasOwn(map, locale));
  const unknown = Object.keys(map).filter((locale) => !locales.includes(locale));
  if (missing.length || unknown.length) {
    throw new Error(
      `payload-redirect: ${name} has invalid locales (missing: ${missing.join(", ") || "none"}; unknown: ${unknown.join(", ") || "none"})`,
    );
  }
  for (const [locale, path] of Object.entries(map)) {
    if (typeof path !== "string") {
      throw new Error(`payload-redirect: ${name}.${locale} must be a string`);
    }
  }
  return map as Record<string, string>;
};

const validatePathOptions = (
  value: unknown,
  entityType: "collection" | "global",
  slug: string,
  locales: string[],
  versions: unknown,
): void => {
  const options = asRecord(value);
  if (!options)
    throw new Error(`payload-redirect: redirect config for "${slug}" must be an object`);

  const unsupported = Object.keys(options).filter((key) => !PATH_OPTIONS.has(key));
  if (unsupported.length) {
    throw new Error(
      `payload-redirect: unsupported redirect option for "${slug}": ${unsupported.join(", ")}`,
    );
  }

  const modes = ["path", "paths", "getPath"].filter((key) => Object.hasOwn(options, key));
  if (options.enabled === false) {
    if (modes.length) {
      throw new Error(
        `payload-redirect: disabled redirect config for "${slug}" cannot define a path`,
      );
    }
    return;
  }
  if (options.enabled !== undefined && options.enabled !== true) {
    throw new Error(`payload-redirect: redirect config for "${slug}" enabled must be a boolean`);
  }
  if (modes.length !== 1) {
    throw new Error(
      `payload-redirect: ${entityType} "${slug}" must configure exactly one of path, paths, or getPath`,
    );
  }
  if (!asRecord(versions)?.drafts) {
    throw new Error(`payload-redirect: automatic redirects for "${slug}" require versions.drafts`);
  }

  if (Object.hasOwn(options, "path")) {
    if (typeof options.path !== "string" || !isValidPathTemplate(options.path)) {
      throw new Error(
        `payload-redirect: ${entityType}s.${slug}.path must be a valid site-relative template`,
      );
    }
  } else if (Object.hasOwn(options, "paths")) {
    if (locales.length === 0) {
      throw new Error(
        `payload-redirect: ${entityType}s.${slug}.paths requires Payload localization`,
      );
    }
    const paths = assertLocaleMap(options.paths, locales, `${entityType}s.${slug}.paths`);
    for (const [locale, path] of Object.entries(paths)) {
      if (!isValidPathTemplate(path)) {
        throw new Error(
          `payload-redirect: ${entityType}s.${slug}.paths.${locale} must be a valid site-relative template`,
        );
      }
    }
  } else if (typeof options.getPath !== "function") {
    throw new Error(`payload-redirect: collections.${slug}.getPath must be a function`);
  }
};

const selectedOptions = (
  entity: { slug: string; custom?: unknown },
  centralOptions: unknown,
): unknown => {
  const central = asRecord(centralOptions);
  if (central && Object.hasOwn(central, entity.slug)) {
    return central[entity.slug];
  }
  return asRecord(entity.custom)?.redirect;
};

const validateOptions = (config: Config, options: RedirectsOptions): void => {
  const locales = localeCodes(config);
  if (options.localePrefixes !== undefined) {
    const prefixes = assertLocaleMap(options.localePrefixes, locales, "localePrefixes");
    for (const [locale, prefix] of Object.entries(prefixes)) {
      if (!isValidLocalePrefix(prefix)) {
        throw new Error(
          `payload-redirect: localePrefixes.${locale} must be a site-relative path prefix`,
        );
      }
    }
  }

  for (const slug of Object.keys(asRecord(options.collections) ?? {})) {
    if (!config.collections?.some((collection) => collection.slug === slug)) {
      throw new Error(`payload-redirect: configured collection "${slug}" is not registered`);
    }
  }

  for (const slug of Object.keys(asRecord(options.globals) ?? {})) {
    if (!config.globals?.some((global) => global.slug === slug)) {
      throw new Error(`payload-redirect: configured global "${slug}" is not registered`);
    }
  }

  for (const collection of config.collections ?? []) {
    const selected = selectedOptions(collection, options.collections);
    if (selected === undefined) continue;
    validatePathOptions(selected, "collection", collection.slug, locales, collection.versions);
  }

  for (const global of config.globals ?? []) {
    const selected = selectedOptions(global, options.globals);
    if (selected === undefined) continue;
    validatePathOptions(selected, "global", global.slug, locales, global.versions);
  }
};

const wireCollectionRedirect = (
  collection: CollectionConfig,
  options: RedirectsOptions,
  collectionSlug: string,
): CollectionConfig => {
  const selected = selectedOptions(collection, options.collections);
  const record = asRecord(selected);
  if (!record || record.enabled === false) return collection;

  const afterChange = collection.hooks?.afterChange;
  const hooks = Array.isArray(afterChange) ? afterChange : afterChange ? [afterChange] : [];
  const redirectOptions = selected as RedirectCollectionOptions;

  return {
    ...collection,
    hooks: {
      ...collection.hooks,
      afterChange: [
        ...hooks,
        createRedirect({
          redirectCollectionSlug: collectionSlug,
          pathOptions: redirectOptions,
          localePrefixes: options.localePrefixes,
        }),
      ],
    },
  };
};

const wireGlobalRedirect = (
  global: GlobalConfig,
  options: RedirectsOptions,
  redirectCollectionSlug: string,
): GlobalConfig => {
  const selected = selectedOptions(global, options.globals);
  const record = asRecord(selected);
  if (!record || record.enabled === false) return global;

  const afterChange = global.hooks?.afterChange;
  const hooks = Array.isArray(afterChange) ? afterChange : afterChange ? [afterChange] : [];
  const pathOptions = selected as RedirectGlobalOptions;

  return {
    ...global,
    hooks: {
      ...global.hooks,
      afterChange: [
        ...hooks,
        createGlobalRedirect({
          globalSlug: global.slug,
          redirectCollectionSlug,
          pathOptions,
          localePrefixes: options.localePrefixes,
        }),
      ],
    },
  };
};

const definedRedirectsPlugin = definePlugin<RedirectsOptions>({
  slug: PLUGIN_SLUG,
  plugin: ({ config, ...options }) => {
    validateOptions(config, options);
    const registeredCount =
      config.plugins?.filter((plugin) => plugin.slug === PLUGIN_SLUG).length ?? 0;
    if (registeredCount > 1) {
      throw new Error("payload-redirect: register redirects() only once in config.plugins");
    }

    const redirectsCollection = createRedirectsCollection(options.overrides);
    const collectionSlug = redirectsCollection.slug || DEFAULT_COLLECTION_SLUG;
    if (config.collections?.some(({ slug }) => slug === collectionSlug)) {
      throw new Error(
        `payload-redirect: collection slug "${collectionSlug}" is already registered; configure it with redirects({ overrides: { slug } }) instead of defining a host collection`,
      );
    }

    return {
      ...config,
      collections: [
        ...(config.collections ?? []).map((collection) =>
          wireCollectionRedirect(collection, options, collectionSlug),
        ),
        redirectsCollection,
      ],
      globals: (config.globals ?? []).map((global) =>
        wireGlobalRedirect(global, options, collectionSlug),
      ),
    };
  },
});

export const redirects = (options: RedirectsOptions = {}): Plugin =>
  definedRedirectsPlugin(options);
