import type { GlobalSlug, PayloadRequest, TypedLocale } from "payload";
import { REDIRECT_CONTEXT_KEYS } from "#redirect/core/redirects/context-keys";
import type { PublicationTransition } from "../types.js";
import { getConfiguredLocales, hasLocalizedDraftStatus, resolveDefaultLocale } from "./locales.js";
import { isDraftSave, isLocalePublished } from "./publish-intent.js";
import {
  isPublishedVersionRow,
  isThisPublication,
  type VersionRow,
} from "./versions/version-rows.js";

const VERSION_PAGE_SIZE = 50;

export const getGlobalPublicationTransition = async ({
  req,
  globalSlug,
}: {
  req: PayloadRequest;
  globalSlug: string;
}): Promise<PublicationTransition[]> => {
  if (
    isDraftSave(req) ||
    req.query?.autosave === "true" ||
    req.query?.autosave === true ||
    req.context?.[REDIRECT_CONTEXT_KEYS.skipAuto]
  ) {
    return [];
  }

  const global = req.payload.globals.config.find(({ slug }) => slug === globalSlug);
  if (!global?.versions?.drafts) return [];

  const slug = globalSlug as GlobalSlug;
  const localizeStatus = hasLocalizedDraftStatus(global);
  const defaultLocale = resolveDefaultLocale(req);
  const transitions: PublicationTransition[] = [];

  for (const locale of getConfiguredLocales(req)) {
    const currentDoc = await req.payload.findGlobal({
      slug,
      ...(locale ? { locale: locale as TypedLocale } : {}),
      fallbackLocale: false,
      depth: 0,
      overrideAccess: true,
      req,
    });
    if (!currentDoc || Object.keys(currentDoc).length === 0) continue;
    if (!isLocalePublished(currentDoc._status, locale ?? "")) continue;

    const rows: VersionRow[] = [];
    let page = 1;
    while (true) {
      const result = await req.payload.findGlobalVersions({
        slug,
        ...(locale ? { locale: locale as TypedLocale } : {}),
        sort: "-updatedAt",
        page,
        limit: VERSION_PAGE_SIZE,
        depth: 0,
        fallbackLocale: false,
        overrideAccess: true,
        req,
      });

      rows.push(
        ...(result.docs as VersionRow[]).filter((row) =>
          isPublishedVersionRow(row, locale, { localizeStatus, defaultLocale }),
        ),
      );
      if (!result.hasNextPage) break;
      page += 1;
    }
    // Only a locale whose newest published version is this operation's takes part; see getPublicationTransition.
    if (!isThisPublication(rows[0], currentDoc.updatedAt)) continue;

    transitions.push({
      locale,
      currentDoc: currentDoc as Record<string, unknown>,
      publishedDocs: rows
        .map((row) => row.version)
        .filter((version): version is Record<string, unknown> => Boolean(version)),
    });
  }

  return transitions;
};
