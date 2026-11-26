export type VersionRow = {
  id?: string | number;
  updatedAt?: string;
  snapshot?: boolean;
  autosave?: boolean;
  publishedLocale?: string;
  published_locale?: string;
  version?: Record<string, unknown>;
};

export const isPublishedVersionRow = (
  row: VersionRow,
  locale: string | undefined,
  options?: { localizeStatus?: boolean; defaultLocale?: string },
): boolean => {
  if (row.snapshot || row.autosave) return false;

  const publishedLocale = row.publishedLocale ?? row.published_locale;
  if (publishedLocale) return publishedLocale === locale;

  const status = row.version?._status;
  if (status === "draft") return false;
  if (status && typeof status === "object" && !Array.isArray(status)) {
    return locale !== undefined && (status as Record<string, unknown>)[locale] === "published";
  }
  if (status === "published") {
    return !options?.localizeStatus || locale !== undefined;
  }
  return false;
};
