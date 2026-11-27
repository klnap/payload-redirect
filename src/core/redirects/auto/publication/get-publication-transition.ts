import type { CollectionAfterChangeHook } from "payload";
import { REDIRECT_CONTEXT_KEYS } from "#redirect/core/redirects/context-keys";
import type { PublicationTransition } from "../types.js";
import { getConfiguredLocales, hasLocalizedDraftStatus, resolveDefaultLocale } from "./locales.js";
import { isDraftSave, isLocalePublished } from "./publish-intent.js";
import { fetchLocalePublishedDoc } from "./versions/document-locale.js";
import { fetchPublishedVersionPages } from "./versions/version-pages.js";
import { isThisPublication, type VersionRow } from "./versions/version-rows.js";

/**
 * A locale takes part only when its newest published version was saved by this operation. That version
 * carries the operation's `updatedAt`; unchanged locales keep an older one, so republishing them creates
 * nothing and never relinks an earlier change.
 */
export const getPublicationTransition = async (
  args: Parameters<CollectionAfterChangeHook>[0],
): Promise<PublicationTransition[]> => {
  const { req, doc, collection } = args;
  if (!collection.versions?.drafts) return [];
  if (isDraftSave(req) || req.context?.[REDIRECT_CONTEXT_KEYS.skipAuto]) return [];

  const docId = doc.id;
  const localizeStatus = hasLocalizedDraftStatus(collection);
  const defaultLocale = resolveDefaultLocale(req);
  const transitions: PublicationTransition[] = [];

  for (const locale of getConfiguredLocales(req)) {
    const currentDoc = await fetchLocalePublishedDoc({ req, collection, docId, locale });
    if (!currentDoc || !isLocalePublished(currentDoc._status, locale ?? "")) continue;

    const rows = await fetchPublishedVersionPages({
      req,
      collectionSlug: collection.slug,
      docId,
      locale,
      versionFilter: { localizeStatus, defaultLocale },
    });
    // currentDoc is re-read from the database, so hook changes and Local API selects cannot hide updatedAt.
    if (!isThisPublication(rows[0], currentDoc.updatedAt)) continue;

    transitions.push({
      locale,
      currentDoc,
      publishedDocs: rows
        .map((row) => row.version)
        .filter((version): version is Record<string, unknown> => Boolean(version)),
    });
  }

  return transitions;
};
