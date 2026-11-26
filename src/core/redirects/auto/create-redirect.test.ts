import { describe, expect, it, mock } from "bun:test";
import { createRedirect } from "./create-redirect";

const makeArgs = ({
  context = {},
  query = { locale: "en" },
  collection = { slug: "pages", versions: { drafts: true }, fields: [] },
  currentDoc = { id: "page-1", category: "new-category", slug: "new", _status: "published" },
  locale = "en",
  localization = { locales: ["en"], defaultLocale: "en" },
  versions = [
    { version: { category: "new-category", slug: "new", _status: "published" } },
    { version: { category: "old-category", slug: "old", _status: "published" } },
  ],
  existing = [],
}: {
  context?: Record<string, unknown>;
  query?: Record<string, unknown>;
  collection?: Record<string, unknown>;
  currentDoc?: Record<string, unknown>;
  locale?: string;
  localization?: Record<string, unknown>;
  versions?: Record<string, unknown>[];
  existing?: Record<string, unknown>[];
} = {}) => {
  const findByID = mock(async () => currentDoc);
  const findVersions = mock(async () => ({ docs: versions, hasNextPage: false }));
  const find = mock(async () => ({ docs: existing }));
  const create = mock(async () => ({}));
  const update = mock(async () => ({}));
  const req = {
    context,
    query,
    locale,
    payload: {
      config: { localization },
      findByID,
      findVersions,
      find,
      create,
      update,
    },
  };
  return {
    args: { req, collection, doc: currentDoc, data: { _status: "published" } },
    findByID,
    findVersions,
    find,
    create,
    update,
    currentDoc,
  };
};

const createForPath = (pathOptions: Parameters<typeof createRedirect>[0]["pathOptions"]) =>
  createRedirect({ collectionSlug: "redirects", pathOptions, localePrefixes: { en: "/en" } });

describe("createRedirect", () => {
  it("skips auto writes when context disables them or the collection has no drafts", async () => {
    const skipped = makeArgs({ context: { payloadRedirectSkipAuto: true } });
    await createForPath({ path: "/[slug]" })(skipped.args as never);
    expect(skipped.findByID).not.toHaveBeenCalled();

    const noDrafts = makeArgs({ collection: { slug: "pages", fields: [] } });
    await createForPath({ path: "/[slug]" })(noDrafts.args as never);
    expect(noDrafts.findByID).not.toHaveBeenCalled();
  });

  it("compares complete published paths, including multiple changed fields", async () => {
    const ctx = makeArgs();
    await createForPath({ path: "/[category]/[slug]" })(ctx.args as never);
    expect(ctx.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "redirects",
        data: {
          from: "/en/old-category/old",
          to: "/en/new-category/new",
          statusCode: "301",
          enabled: true,
          origin: "auto",
        },
      }),
    );
  });

  it("skips unchanged paths, first publications, and unpublished documents", async () => {
    const unchanged = makeArgs({
      currentDoc: { id: "p", _status: "published" },
      versions: [{ version: { _status: "published" } }],
    });
    await createForPath({ path: "/fixed" })(unchanged.args as never);
    expect(unchanged.find).not.toHaveBeenCalled();

    const firstPublish = makeArgs({
      currentDoc: { id: "p", slug: "new", _status: "published" },
      versions: [{ version: { slug: "new", _status: "published" } }],
    });
    await createForPath({ path: "/[slug]" })(firstPublish.args as never);
    expect(firstPublish.find).not.toHaveBeenCalled();

    const unpublished = makeArgs({ currentDoc: { id: "p", slug: "new", _status: "draft" } });
    await createForPath({ path: "/[slug]" })(unpublished.args as never);
    expect(unpublished.findByID).toHaveBeenCalledTimes(1);
    expect(unpublished.findVersions).not.toHaveBeenCalled();
  });

  it("skips repeated current-path snapshots to find the previous distinct path", async () => {
    const repeated = makeArgs({
      currentDoc: { id: "p", slug: "same", _status: "published" },
      versions: [
        { version: { slug: "same", _status: "published" } },
        { version: { slug: "same", _status: "published" } },
        { version: { slug: "older", _status: "published" } },
      ],
    });
    await createForPath({ path: "/[slug]" })(repeated.args as never);
    expect(repeated.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          from: "/en/older",
          to: "/en/same",
          statusCode: "301",
          enabled: true,
          origin: "auto",
        },
      }),
    );
  });

  it("skips draft saves and unsafe or unresolved previous paths", async () => {
    const draftSave = makeArgs({ query: { locale: "en", draft: "true" } });
    await createForPath({ path: "/[slug]" })(draftSave.args as never);
    expect(draftSave.findByID).not.toHaveBeenCalled();

    const unresolved = makeArgs({
      versions: [
        { version: { slug: "new", _status: "published" } },
        { version: { _status: "published" } },
        { version: { slug: "older", _status: "published" } },
      ],
    });
    await createForPath({ path: "/[slug]" })(unresolved.args as never);
    expect(unresolved.find).not.toHaveBeenCalled();
  });

  it("does not replace manual redirects for a previous source path", async () => {
    const manual = makeArgs({ existing: [{ id: "r1", origin: "manual", to: "/manual" }] });
    await createForPath({ path: "/[slug]" })(manual.args as never);
    expect(manual.create).not.toHaveBeenCalled();
    expect(manual.update).not.toHaveBeenCalled();
  });

  it("uses locale-specific templates and does not fall back across locales", async () => {
    const localized = makeArgs({
      locale: "pl",
      localization: { locales: ["pl", "en"], defaultLocale: "pl" },
      currentDoc: { id: "p", slug: "nowy", _status: { pl: "published" } },
      versions: [
        { version: { slug: { pl: "nowy" }, _status: { pl: "published" } } },
        { version: { slug: { en: "old" }, _status: { pl: "published" } } },
      ],
    });
    await createRedirect({
      collectionSlug: "redirects",
      pathOptions: { paths: { pl: "/artykuly/[slug]", en: "/articles/[slug]" } },
      localePrefixes: { pl: "", en: "/en" },
    })(localized.args as never);
    expect(localized.create).not.toHaveBeenCalled();
  });
});
