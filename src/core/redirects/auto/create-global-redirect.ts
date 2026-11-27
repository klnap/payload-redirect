import type { DataFromGlobalSlug, GlobalAfterChangeHook, GlobalSlug } from "payload";
import { createRedirectsFromTransitions } from "#redirect/core/redirects/auto/create-redirect";
import { getGlobalPublicationTransition } from "#redirect/core/redirects/auto/publication/global-transition";
import { REDIRECT_CONTEXT_KEYS } from "#redirect/core/redirects/context-keys";
import type { LocalePrefixes } from "#redirect/core/url/published-path";
import type { RedirectPathOptions } from "#redirect/core/redirects/auto/types";

type CreateGlobalRedirectOptions<TSlug extends GlobalSlug = GlobalSlug> = {
  globalSlug: TSlug;
  redirectCollectionSlug: string;
  pathOptions: RedirectPathOptions<DataFromGlobalSlug<TSlug>>;
  localePrefixes?: LocalePrefixes;
};

export const createGlobalRedirect =
  <TSlug extends GlobalSlug>({
    globalSlug,
    redirectCollectionSlug,
    pathOptions,
    localePrefixes,
  }: CreateGlobalRedirectOptions<TSlug>): GlobalAfterChangeHook =>
  async (args) => {
    if (pathOptions.enabled === false || args.req.context?.[REDIRECT_CONTEXT_KEYS.skipAuto]) {
      return args.doc;
    }

    const transitions = await getGlobalPublicationTransition({ req: args.req, globalSlug });
    await createRedirectsFromTransitions({
      req: args.req,
      redirectCollectionSlug,
      pathOptions,
      localePrefixes,
      transitions,
    });

    return args.doc;
  };
