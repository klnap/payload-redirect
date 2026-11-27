import { describe, expect, it, mock } from "bun:test";
import { REDIRECT_CONTEXT_KEYS } from "#redirect/core/redirects/context-keys";
import { getPublicationTransition } from "./get-publication-transition";

const THIS_PUBLICATION = "2026-01-02T00:00:00.000Z";
const EARLIER_PUBLICATION = "2026-01-01T00:00:00.000Z";

type Row = { version: Record<string, unknown> };

/**
 * `versions` may depend on the locale. The first row is the newest published snapshot for that locale;
 * it belongs to this operation only when its `version.updatedAt` equals the operation's `updatedAt`.
 */
const makeArgs = ({
  collection = { slug: "pages", fields: [], versions: { drafts: true } },
  doc = { id: "page-1", _status: "published", updatedAt: THIS_PUBLICATION },
  query = {},
  context = {},
  locales = [] as string[],
  currentDoc = { id: "page-1", _status: "published" },
  versions = [{ version: { _status: "published", updatedAt: THIS_PUBLICATION } }] as Row[],
}: {
  collection?: Record<string, unknown>;
  doc?: Record<string, unknown>;
  query?: Record<string, unknown>;
  context?: Record<string, unknown>;
  locales?: string[];
  currentDoc?: Record<string, unknown>;
  versions?: Row[] | ((locale: string | undefined) => Row[]);
} = {}) => {
  const findByID = mock(async (_args: unknown) => currentDoc);
  const findVersions = mock(async (args: { locale?: string }) => ({
    docs: typeof versions === "function" ? versions(args.locale) : versions,
    hasNextPage: false,
  }));
  const req = {
    context,
    query,
    locale: locales[0],
    payload: {
      config: { localization: locales.length ? { locales, defaultLocale: locales[0] } : false },
      findByID,
      findVersions,
    },
  };
  return { args: { req, collection, doc, data: {} }, findByID, findVersions };
};

describe("getPublicationTransition", () => {
  it("skips non-versioned collections, draft saves, and internal writes", async () => {
    const noVersions = makeArgs({ collection: { slug: "pages", fields: [] } });
    expect(await getPublicationTransition(noVersions.args as never)).toEqual([]);

    const draftSave = makeArgs({ query: { draft: true } });
    expect(await getPublicationTransition(draftSave.args as never)).toEqual([]);

    const internalWrite = makeArgs({ context: { [REDIRECT_CONTEXT_KEYS.skipAuto]: true } });
    expect(await getPublicationTransition(internalWrite.args as never)).toEqual([]);
    expect(internalWrite.findByID).not.toHaveBeenCalled();
  });

  it("returns the snapshots of this publication first, without fallback locales", async () => {
    const ctx = makeArgs({
      locales: ["en", "fr"],
      currentDoc: { id: "page-1", slug: "current", _status: "published" },
      versions: [
        { version: { slug: "current", _status: "published", updatedAt: THIS_PUBLICATION } },
        { version: { slug: "previous", _status: "published", updatedAt: EARLIER_PUBLICATION } },
      ],
    });

    const transitions = await getPublicationTransition(ctx.args as never);
    expect(transitions.map(({ locale }) => locale)).toEqual(["en", "fr"]);
    expect(transitions[0]?.publishedDocs).toEqual([
      { slug: "current", _status: "published", updatedAt: THIS_PUBLICATION },
      { slug: "previous", _status: "published", updatedAt: EARLIER_PUBLICATION },
    ]);
    expect(ctx.findByID.mock.calls[0]?.[0]).toMatchObject({ locale: "en", fallbackLocale: false });
    expect(ctx.findVersions.mock.calls[0]?.[0]).toMatchObject({
      locale: "en",
      fallbackLocale: false,
    });
  });

  it("skips a locale whose newest published version predates this operation", async () => {
    // Publishing en must not relink fr, whose last publication was an earlier operation.
    const ctx = makeArgs({
      locales: ["en", "fr"],
      doc: {
        id: "page-1",
        _status: { en: "published", fr: "published" },
        updatedAt: THIS_PUBLICATION,
      },
      currentDoc: { id: "page-1", _status: { en: "published", fr: "published" } },
      versions: (locale) =>
        locale === "en"
          ? [
              {
                version: {
                  _status: { en: "published", fr: "published" },
                  updatedAt: THIS_PUBLICATION,
                },
              },
            ]
          : [
              {
                version: {
                  _status: { en: "published", fr: "published" },
                  updatedAt: EARLIER_PUBLICATION,
                },
              },
            ],
    });

    const transitions = await getPublicationTransition(ctx.args as never);
    expect(transitions.map(({ locale }) => locale)).toEqual(["en"]);
  });

  it("takes part without request query flags, as the Local API does", async () => {
    // Local API publish-all and publishSpecificLocale arrive as operation arguments, not in req.query.
    const ctx = makeArgs({
      locales: ["en", "fr", "de"],
      doc: {
        id: "page-1",
        _status: { en: "published", fr: "published", de: "published" },
        updatedAt: THIS_PUBLICATION,
      },
      currentDoc: { id: "page-1", _status: { en: "published", fr: "published", de: "published" } },
      collection: { slug: "pages", fields: [], versions: { drafts: { localizeStatus: true } } },
      query: {},
    });

    const transitions = await getPublicationTransition(ctx.args as never);
    expect(transitions.map(({ locale }) => locale)).toEqual(["en", "fr", "de"]);
  });

  it("processes only locales that are published, for localized status", async () => {
    const ctx = makeArgs({
      locales: ["en", "fr"],
      collection: { slug: "pages", fields: [], versions: { drafts: { localizeStatus: true } } },
      doc: { id: "page-1", _status: { en: "published", fr: "draft" }, updatedAt: THIS_PUBLICATION },
      currentDoc: { id: "page-1", _status: { en: "published", fr: "draft" } },
    });

    const transitions = await getPublicationTransition(ctx.args as never);
    expect(transitions.map(({ locale }) => locale)).toEqual(["en"]);
    expect(ctx.findByID).toHaveBeenCalledTimes(2);
  });

  it("handles non-localized Payload configs without inventing a locale", async () => {
    const ctx = makeArgs({
      currentDoc: { id: "page-1", slug: "current", _status: "published" },
    });

    const transitions = await getPublicationTransition(ctx.args as never);
    expect(transitions).toHaveLength(1);
    expect(transitions[0]?.locale).toBeUndefined();
    expect(ctx.findByID.mock.calls[0]?.[0]).not.toHaveProperty("locale");
    expect(ctx.findVersions.mock.calls[0]?.[0]).not.toHaveProperty("locale");
  });

  it("does not read history for unpublished documents", async () => {
    const ctx = makeArgs({ currentDoc: { id: "page-1", _status: "draft" } });

    expect(await getPublicationTransition(ctx.args as never)).toEqual([]);
    expect(ctx.findVersions).not.toHaveBeenCalled();
  });
});
