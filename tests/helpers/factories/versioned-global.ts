import type { GlobalConfig } from "payload";

export const versionedAboutGlobal = (
  options: { localized?: boolean; autosave?: boolean; path?: string } = {},
): GlobalConfig => ({
  slug: "about-page",
  versions: {
    drafts: {
      autosave: options.autosave ?? false,
    },
  },
  fields: [
    { name: "title", type: "text", ...(options.localized ? { localized: true } : {}) },
    {
      name: "slug",
      type: "text",
      required: true,
      ...(options.localized ? { localized: true } : {}),
    },
  ],
  custom: { redirect: { path: options.path ?? "/[slug]" } },
});
