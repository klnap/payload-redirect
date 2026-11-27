import type { CollectionAfterChangeHook, PayloadRequest } from "payload";
import { ensureAutoRedirect } from "#redirect/core/redirects/auto/persist-auto-rule";
import { getPublicationTransition } from "#redirect/core/redirects/auto/publication/get-publication-transition";
import { REDIRECT_CONTEXT_KEYS } from "#redirect/core/redirects/context-keys";
import { normalizePathOrUrl } from "#redirect/core/redirects/normalize-path";
import { buildPublishedPath, type LocalePrefixes } from "#redirect/core/url/published-path";
import type { PublicationTransition, RedirectPathOptions } from "./types.js";

type CreateRedirectOptions<TDocument = Record<string, unknown>> = {
  redirectCollectionSlug: string;
  pathOptions: RedirectPathOptions<TDocument>;
  localePrefixes?: LocalePrefixes;
};

export const createRedirectsFromTransitions = async <TDocument>({
  req,
  redirectCollectionSlug,
  pathOptions,
  localePrefixes,
  transitions,
}: CreateRedirectOptions<TDocument> & {
  req: PayloadRequest;
  transitions: PublicationTransition[];
}): Promise<void> => {
  for (const { currentDoc, publishedDocs, locale } of transitions) {
    const currentPath = buildPublishedPath(pathOptions, currentDoc, locale, localePrefixes);
    if (!currentPath) continue;

    const to = normalizePathOrUrl(currentPath);
    const previousPublishedDoc = publishedDocs.find((publishedDoc) => {
      const path = buildPublishedPath(pathOptions, publishedDoc, locale, localePrefixes);
      return !path || normalizePathOrUrl(path) !== to;
    });
    if (!previousPublishedDoc) continue;

    const previousPath = buildPublishedPath(
      pathOptions,
      previousPublishedDoc,
      locale,
      localePrefixes,
    );
    if (!previousPath) continue;

    const from = normalizePathOrUrl(previousPath);
    if (from === to) continue;

    await ensureAutoRedirect({
      req,
      collectionSlug: redirectCollectionSlug,
      rule: { from, to },
      context: req.context,
    });
  }
};

export const createRedirect =
  <TDocument = Record<string, unknown>>({
    redirectCollectionSlug,
    pathOptions,
    localePrefixes,
  }: CreateRedirectOptions<TDocument>): CollectionAfterChangeHook =>
  async (args) => {
    if (pathOptions.enabled === false) return args.doc;
    if (args.req.context?.[REDIRECT_CONTEXT_KEYS.skipAuto]) return args.doc;

    const transitions = await getPublicationTransition(args);
    await createRedirectsFromTransitions({
      req: args.req,
      redirectCollectionSlug,
      pathOptions,
      localePrefixes,
      transitions,
    });

    return args.doc;
  };
