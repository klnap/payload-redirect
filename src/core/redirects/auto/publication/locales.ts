import type { PayloadRequest } from "payload";

const listLocales = (req: PayloadRequest): string[] => {
  const localization = req.payload.config.localization;
  if (localization === false || !localization) return [];
  return localization.locales.map((locale) => (typeof locale === "string" ? locale : locale.code));
};

export const getConfiguredLocales = (req: PayloadRequest): Array<string | undefined> => {
  const locales = listLocales(req);
  return locales.length > 0 ? locales : [undefined];
};

export const hasLocalizedDraftStatus = (collection: {
  versions?: { drafts?: unknown } | false;
}): boolean => {
  const drafts = collection.versions === false ? undefined : collection.versions?.drafts;
  return Boolean(
    drafts && typeof drafts === "object" && "localizeStatus" in drafts && drafts.localizeStatus,
  );
};

export const resolveDefaultLocale = (req: PayloadRequest): string | undefined => {
  const localization = req.payload.config.localization;
  return localization ? localization.defaultLocale : undefined;
};
