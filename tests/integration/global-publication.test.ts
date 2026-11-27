import { describe, expect, it } from "bun:test";
import type { GlobalConfig } from "payload";
import { versionedAboutGlobal } from "../helpers/factories/versioned-global";
import { versionedArticlesCollection } from "../helpers/factories/versioned-document";
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
  withPublishAllLocales,
} from "../helpers/payload-harness";

const findRedirects = async (handle: RedirectIntHandle) =>
  handle.payload.find({ collection: "redirects", overrideAccess: true, sort: "from" });

const publishAbout = async (
  handle: RedirectIntHandle,
  slug: string,
  options: { draft?: boolean; autosave?: boolean } = {},
) =>
  handle.payload.updateGlobal({
    slug: "about-page",
    data: { slug, _status: "draft" },
    ...(options.draft ? { draft: true } : {}),
    ...(options.autosave ? { autosave: true } : {}),
  });

const publishGlobalStatus = (handle: RedirectIntHandle) =>
  handle.payload.updateGlobal({
    slug: "about-page",
    data: { _status: "published" },
  });

describe.skipIf(!intDatabaseConfigured)("Global automatic redirects", () => {
  it("tracks published paths, ignores drafts and autosaves, and handles unpublish/republication", async () => {
    const handle = await createRedirectIntPayload({
      globals: [versionedAboutGlobal({ autosave: true })],
    });
    try {
      await publishAbout(handle, "draft-only", { draft: true });
      expect((await findRedirects(handle)).totalDocs).toBe(0);

      await publishGlobalStatus(handle);
      expect((await findRedirects(handle)).totalDocs).toBe(0);

      await publishAbout(handle, "autosave-only", { draft: true, autosave: true });
      expect((await findRedirects(handle)).totalDocs).toBe(0);
      expect(
        await handle.payload.findGlobal({ slug: "about-page", overrideAccess: true }),
      ).toMatchObject({
        slug: "draft-only",
        _status: "published",
      });

      await publishAbout(handle, "published", { draft: true });
      await publishGlobalStatus(handle);
      expect(await findRedirects(handle)).toMatchObject({
        totalDocs: 1,
        docs: [{ from: "/draft-only", to: "/published", origin: "auto" }],
      });

      await publishGlobalStatus(handle);
      expect((await findRedirects(handle)).totalDocs).toBe(1);

      await handle.payload.updateGlobal({
        slug: "about-page",
        data: { _status: "draft" },
      });
      expect((await findRedirects(handle)).totalDocs).toBe(1);
      expect(
        await handle.payload.findGlobal({ slug: "about-page", overrideAccess: true }),
      ).toMatchObject({
        _status: "draft",
      });

      await publishAbout(handle, "republished", { draft: true });
      await publishGlobalStatus(handle);
      expect((await findRedirects(handle)).docs.map(({ from, to }) => [from, to])).toEqual([
        ["/draft-only", "/published"],
        ["/published", "/republished"],
      ]);
    } finally {
      await handle.destroy();
    }
  });

  it("tracks one localized Global path change without fallback or unrelated locale redirects", async () => {
    const handle = await createRedirectIntPayload({
      globals: [versionedAboutGlobal({ localized: true })],
      localization: {
        locales: ["en", "pl", "de"],
        defaultLocale: "en",
        fallback: true,
      },
      localePrefixes: { en: "", pl: "/pl", de: "/de" },
    });
    try {
      for (const [locale, slug] of [
        ["en", "about"],
        ["pl", "o-nas"],
        ["de", "uber-uns"],
      ] as const) {
        await handle.payload.updateGlobal({
          slug: "about-page",
          locale,
          data: { slug, title: slug, _status: "draft" },
          draft: true,
        });
      }
      await handle.payload.updateGlobal({
        slug: "about-page",
        data: { _status: "published" },
        ...withPublishAllLocales,
      });

      await handle.payload.updateGlobal({
        slug: "about-page",
        locale: "pl",
        data: { slug: "o-firmie" },
        draft: true,
      });
      await handle.payload.updateGlobal({
        slug: "about-page",
        data: { _status: "published" },
        ...withPublishAllLocales,
      });

      expect(await findRedirects(handle)).toMatchObject({
        totalDocs: 1,
        docs: [{ from: "/pl/o-nas", to: "/pl/o-firmie", statusCode: "301" }],
      });
    } finally {
      await handle.destroy();
    }
  });

  it("uses privileged redirect persistence without changing Global access policies", async () => {
    const global: GlobalConfig = {
      ...versionedAboutGlobal(),
      access: { update: ({ req }) => Boolean(req.user) },
    };
    const user = { id: "publisher" };
    const handle = await createRedirectIntPayload({
      globals: [global],
      redirectOverrides: {
        access: {
          create: () => false,
          read: () => false,
          update: () => false,
        },
      },
    });
    try {
      await handle.payload.updateGlobal({
        slug: "about-page",
        data: { slug: "before", _status: "published" },
        overrideAccess: false,
        user: user as never,
      });
      await handle.payload.updateGlobal({
        slug: "about-page",
        data: { slug: "after" },
        overrideAccess: false,
        user: user as never,
      });

      const rules = await handle.payload.find({ collection: "redirects", overrideAccess: true });
      expect(rules.totalDocs).toBe(1);
      expect(rules.docs[0]).toMatchObject({ from: "/before", to: "/after" });

      await expect(
        handle.payload.findGlobal({ slug: "about-page", overrideAccess: false }),
      ).rejects.toThrow();
    } finally {
      await handle.destroy();
    }
  });

  it("runs on historical restore and rolls back restores that would create a redirect cycle", async () => {
    const handle = await createRedirectIntPayload({
      globals: [versionedAboutGlobal()],
    });
    try {
      await publishAbout(handle, "first", { draft: true });
      await publishGlobalStatus(handle);
      await publishAbout(handle, "second", { draft: true });
      await publishGlobalStatus(handle);

      const versions = await handle.payload.findGlobalVersions({
        slug: "about-page",
        overrideAccess: true,
        sort: "-updatedAt",
        pagination: false,
      });
      const firstVersion = versions.docs.find((version) => version.version?.slug === "first");
      expect(firstVersion).toBeDefined();
      if (!firstVersion) throw new Error("Initial Global version was not saved");

      await expect(
        handle.payload.restoreGlobalVersion({
          slug: "about-page",
          id: firstVersion.id,
          overrideAccess: true,
        }),
      ).rejects.toThrow("The following field is invalid: to");

      expect(
        await handle.payload.findGlobal({ slug: "about-page", overrideAccess: true }),
      ).toMatchObject({ slug: "second", _status: "published" });
      expect(await findRedirects(handle)).toMatchObject({
        totalDocs: 1,
        docs: [{ from: "/first", to: "/second" }],
      });
    } finally {
      await handle.destroy();
    }
  });

  it("shares cycle validation and transaction rollback with Collection-generated rules", async () => {
    const articles = {
      ...versionedArticlesCollection(),
      custom: { redirect: { path: "/shared/[slug]" } },
    };
    const handle = await createRedirectIntPayload({
      collections: [articles],
      globals: [versionedAboutGlobal({ path: "/shared/[slug]" })],
    });
    try {
      const article = await handle.payload.create({
        collection: "articles",
        data: { slug: "old", title: "Old", _status: "published" },
      });
      await handle.payload.update({
        collection: "articles",
        id: article.id,
        data: { slug: "new" },
        draft: true,
      });
      await handle.payload.update({
        collection: "articles",
        id: article.id,
        data: { _status: "published" },
      });

      await publishAbout(handle, "new", { draft: true });
      await publishGlobalStatus(handle);
      await publishAbout(handle, "old", { draft: true });

      await expect(publishGlobalStatus(handle)).rejects.toThrow(
        "The following field is invalid: to",
      );
      expect(
        await handle.payload.findGlobal({ slug: "about-page", overrideAccess: true }),
      ).toMatchObject({ slug: "new", _status: "published" });
      expect(await findRedirects(handle)).toMatchObject({
        totalDocs: 1,
        docs: [{ from: "/shared/old", to: "/shared/new", origin: "auto" }],
      });
    } finally {
      await handle.destroy();
    }
  });

  it("preserves manual rules when a Global publication targets their source", async () => {
    const handle = await createRedirectIntPayload({
      globals: [versionedAboutGlobal()],
    });
    try {
      await handle.payload.create({
        collection: "redirects",
        data: { from: "/before", to: "/manual-target", statusCode: "302" },
        overrideAccess: true,
      });
      await publishAbout(handle, "before", { draft: true });
      await publishGlobalStatus(handle);
      await publishAbout(handle, "after", { draft: true });
      await publishGlobalStatus(handle);

      expect(await findRedirects(handle)).toMatchObject({
        totalDocs: 1,
        docs: [{ from: "/before", to: "/manual-target", statusCode: "302", origin: "manual" }],
      });
    } finally {
      await handle.destroy();
    }
  });
});
