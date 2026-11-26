import { applyDynamicSegments, hasControlCharacter, isValidPathTemplate } from "./route-params.js";

export type LocalePrefixes = Record<string, string>;

export type PublishedPathConfiguration = {
  path?: string;
  paths?: Record<string, string>;
  getPath?: unknown;
};

const localeCode = (locale: unknown): string | undefined => {
  if (typeof locale === "string") return locale || undefined;
  if (locale && typeof locale === "object" && "code" in locale) {
    const code = (locale as { code?: unknown }).code;
    return typeof code === "string" && code ? code : undefined;
  }
  return undefined;
};

export const isValidLocalePrefix = (prefix: string): boolean =>
  prefix === "" ||
  (prefix.startsWith("/") &&
    !prefix.startsWith("//") &&
    !prefix.includes("?") &&
    !prefix.includes("#") &&
    !prefix.includes("\\") &&
    !hasControlCharacter(prefix));

const withPrefix = (prefix: string, path: string): string =>
  path === "/" ? prefix || "/" : `${prefix}${path}`;

const isSiteRelativePath = (path: string): boolean =>
  path.startsWith("/") &&
  !path.startsWith("//") &&
  !path.includes("?") &&
  !path.includes("#") &&
  !path.includes("\\") &&
  !hasControlCharacter(path);

export const buildPublishedPath = (
  config: PublishedPathConfiguration,
  doc: Record<string, unknown>,
  locale: unknown,
  localePrefixes?: LocalePrefixes,
): string | null => {
  if (typeof config.getPath === "function") {
    const path = (
      config.getPath as (args: { doc: Record<string, unknown>; locale: unknown }) => unknown
    )({
      doc,
      locale,
    });
    if (path === null) return null;
    if (typeof path !== "string") return null;
    return isSiteRelativePath(path) ? path : null;
  }

  const code = localeCode(locale);
  const template =
    config.paths !== undefined ? (code ? config.paths[code] : undefined) : config.path;
  if (typeof template !== "string" || !isValidPathTemplate(template)) return null;

  const resolved = applyDynamicSegments(template, doc, code);
  if (resolved === null) return null;

  if (localePrefixes === undefined) return resolved;
  if (!code || !Object.hasOwn(localePrefixes, code)) return null;
  return withPrefix(localePrefixes[code]!, resolved);
};
