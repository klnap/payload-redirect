import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import type { CollectionConfig, GlobalConfig, Payload } from "payload";
import { versionedArticlesCollection } from "../helpers/factories/versioned-document";
import {
  createRedirectIntPayload,
  draftVersions,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from "../helpers/payload-harness";

const articlesWith = (
  versions: Record<string, unknown>,
  slugRequired = true,
): CollectionConfig => ({
  ...versionedArticlesCollection(false, { slugRequired }),
  versions,
});

const aboutGlobal = (): GlobalConfig => ({
  slug: "about-page",
  versions: { drafts: draftVersions.drafts },
  fields: [
    { name: "title", type: "text" },
    { name: "slug", type: "text", required: true },
  ],
  custom: { redirect: { path: "/[slug]" } },
});

const redirectRows = async (payload: Payload) => {
  const { docs } = await payload.find({
    collection: "redirects",
    overrideAccess: true,
    pagination: false,
    sort: "from",
  });
  return docs.map((doc) => [doc.from, doc.to, doc.origin]);
};

const publishArticle = (payload: Payload, id: string | number, data: Record<string, unknown>) =>
  payload.update({
    collection: "articles",
    id,
    data: { ...data, _status: "published" },
    overrideAccess: true,
  });

const draftArticle = (payload: Payload, id: string | number, data: Record<string, unknown>) =>
  payload.update({ collection: "articles", id, data, draft: true, overrideAccess: true });

/**
 * Collection and Global history behavior that the existing suites do not cover: consecutive changes,
 * republication, unpublish/republish, historical restore success and rejection, long history paging,
 * retention, and history that holds no usable path.
 */
describe.skipIf(!intDatabaseConfigured)("publication history for Collections and Globals", () => {
  describe("Collections with unlimited history", () => {
    let handle: RedirectIntHandle;

    beforeAll(async () => {
      handle = await createRedirectIntPayload({
        collections: [articlesWith({ drafts: draftVersions.drafts })],
      });
    }, 120_000);

    afterAll(async () => {
      await handle.destroy();
    });

    beforeEach(async () => {
      await handle.resetArticles();
      await handle.resetRedirects();
    });

    it("consecutive published slug changes link each pair and nothing else", async () => {
      const created = await handle.payload.create({
        collection: "articles",
        data: { slug: "a", title: "A", _status: "published" },
        overrideAccess: true,
      });
      await publishArticle(handle.payload, created.id, { slug: "b" });
      await publishArticle(handle.payload, created.id, { slug: "c" });

      expect(await redirectRows(handle.payload)).toEqual([
        ["/a", "/b", "auto"],
        ["/b", "/c", "auto"],
      ]);
    });

    it("republishing an unchanged path creates nothing", async () => {
      const created = await handle.payload.create({
        collection: "articles",
        data: { slug: "a", title: "A", _status: "published" },
        overrideAccess: true,
      });
      await publishArticle(handle.payload, created.id, { title: "A again" });

      expect(await redirectRows(handle.payload)).toEqual([]);
    });

    it("republishing an unchanged path does not recreate a rule an admin deleted", async () => {
      const created = await handle.payload.create({
        collection: "articles",
        data: { slug: "a", title: "A", _status: "published" },
        overrideAccess: true,
      });
      await publishArticle(handle.payload, created.id, { slug: "b" });
      await handle.payload.delete({
        collection: "redirects",
        where: { from: { equals: "/a" } },
        overrideAccess: true,
      });

      await publishArticle(handle.payload, created.id, { title: "B again" });

      expect(await redirectRows(handle.payload)).toEqual([]);
    });

    it("unpublish followed by a changed republication links to the last published path", async () => {
      const created = await handle.payload.create({
        collection: "articles",
        data: { slug: "a", title: "A", _status: "published" },
        overrideAccess: true,
      });
      await draftArticle(handle.payload, created.id, { _status: "draft" } as never);
      await publishArticle(handle.payload, created.id, { slug: "b" });

      expect(await redirectRows(handle.payload)).toEqual([["/a", "/b", "auto"]]);
    });

    it("finds the last published version even when more than one page of drafts intervenes", async () => {
      const created = await handle.payload.create({
        collection: "articles",
        data: { slug: "a", title: "A", _status: "published" },
        overrideAccess: true,
      });
      // findVersions pages in batches of 50; the published row must be found on page two or later.
      for (let index = 0; index < 60; index += 1) {
        await draftArticle(handle.payload, created.id, { title: `draft ${index}` });
      }
      await publishArticle(handle.payload, created.id, { slug: "b" });

      expect(await redirectRows(handle.payload)).toEqual([["/a", "/b", "auto"]]);
    });

    it("restoring a historical published version publishes it and links the change once the forward rule is gone", async () => {
      const created = await handle.payload.create({
        collection: "articles",
        data: { slug: "a", title: "A", _status: "published" },
        overrideAccess: true,
      });
      await publishArticle(handle.payload, created.id, { slug: "b" });
      // The forward rule /a -> /b would close a cycle with the restore, so the admin removes it first.
      await handle.payload.delete({
        collection: "redirects",
        where: { from: { equals: "/a" } },
        overrideAccess: true,
      });

      const versions = await handle.payload.findVersions({
        collection: "articles",
        where: { parent: { equals: created.id } },
        sort: "-updatedAt",
        pagination: false,
        overrideAccess: true,
      });
      const original = versions.docs.find((row) => row.version?.slug === "a");
      expect(original).toBeDefined();
      if (!original) throw new Error("Original version was not saved");

      await handle.payload.restoreVersion({
        collection: "articles",
        id: original.id,
        overrideAccess: true,
      });

      const current = await handle.payload.findByID({
        collection: "articles",
        id: created.id,
        draft: true,
        overrideAccess: true,
      });
      expect(current.slug).toBe("a");
      expect(current._status).toBe("published");
      expect(await redirectRows(handle.payload)).toEqual([["/b", "/a", "auto"]]);
    });

    it("a restore that would close a redirect cycle is refused and leaves the document unchanged", async () => {
      const created = await handle.payload.create({
        collection: "articles",
        data: { slug: "a", title: "A", _status: "published" },
        overrideAccess: true,
      });
      await publishArticle(handle.payload, created.id, { slug: "b" });
      // The auto rule /a -> /b is replaced by a manual rule in the same direction, so the restore to "a"
      // from "b" is the write that would close /a -> /b -> /a. Nothing else closes it earlier.
      await handle.payload.delete({
        collection: "redirects",
        where: { from: { equals: "/a" } },
        overrideAccess: true,
      });
      await handle.payload.create({
        collection: "redirects",
        data: { from: "/a", to: "/b", statusCode: 301, enabled: true },
        overrideAccess: true,
      });

      const versions = await handle.payload.findVersions({
        collection: "articles",
        where: { parent: { equals: created.id } },
        sort: "-updatedAt",
        pagination: false,
        overrideAccess: true,
      });
      const original = versions.docs.find((row) => row.version?.slug === "a");
      if (!original) throw new Error("Original version was not saved");

      await expect(
        handle.payload.restoreVersion({
          collection: "articles",
          id: original.id,
          overrideAccess: true,
        }),
      ).rejects.toThrow();

      const current = await handle.payload.findByID({
        collection: "articles",
        id: created.id,
        draft: true,
        overrideAccess: true,
      });
      expect(current.slug).toBe("b");
      expect(current._status).toBe("published");
      expect(await redirectRows(handle.payload)).toEqual([["/a", "/b", "manual"]]);
    });
  });

  describe("Collections with retention limit", () => {
    let handle: RedirectIntHandle;

    beforeAll(async () => {
      handle = await createRedirectIntPayload({
        collections: [articlesWith({ drafts: draftVersions.drafts, maxPerDoc: 2 })],
      });
    }, 120_000);

    afterAll(async () => {
      await handle.destroy();
    });

    beforeEach(async () => {
      await handle.resetArticles();
      await handle.resetRedirects();
    });

    it("a publication whose previous published version was pruned creates no rule", async () => {
      const created = await handle.payload.create({
        collection: "articles",
        data: { slug: "a", title: "A", _status: "published" },
        overrideAccess: true,
      });
      for (let index = 0; index < 3; index += 1) {
        await draftArticle(handle.payload, created.id, { title: `draft ${index}` });
      }
      await publishArticle(handle.payload, created.id, { slug: "b" });

      // Documented boundary: the plugin reads only retained history, so the pruned "/a" is not linked.
      expect(await redirectRows(handle.payload)).toEqual([]);
    });
  });

  describe("Collections with history that holds no usable slug", () => {
    let handle: RedirectIntHandle;

    beforeAll(async () => {
      handle = await createRedirectIntPayload({
        collections: [articlesWith({ drafts: draftVersions.drafts }, false)],
      });
    }, 120_000);

    afterAll(async () => {
      await handle.destroy();
    });

    beforeEach(async () => {
      await handle.resetArticles();
      await handle.resetRedirects();
    });

    it("a published version without a slug is skipped in both directions", async () => {
      const created = await handle.payload.create({
        collection: "articles",
        data: { title: "no slug", _status: "published" } as never,
        overrideAccess: true,
      });
      await publishArticle(handle.payload, created.id, { slug: "b" });
      await publishArticle(handle.payload, created.id, { slug: "c" });

      expect(await redirectRows(handle.payload)).toEqual([["/b", "/c", "auto"]]);
    });
  });

  describe("Globals", () => {
    let handle: RedirectIntHandle;

    beforeAll(async () => {
      handle = await createRedirectIntPayload({ globals: [aboutGlobal()] });
    }, 120_000);

    afterAll(async () => {
      await handle.destroy();
    });

    beforeEach(async () => {
      await handle.resetRedirects();
    });

    it("restoring a historical Global version publishes it and links the change once the forward rule is gone", async () => {
      await handle.payload.updateGlobal({
        slug: "about-page",
        data: { slug: "first", _status: "published" },
        overrideAccess: true,
      });
      await handle.payload.updateGlobal({
        slug: "about-page",
        data: { slug: "second", _status: "published" },
        overrideAccess: true,
      });
      await handle.payload.delete({
        collection: "redirects",
        where: { from: { equals: "/first" } },
        overrideAccess: true,
      });

      const versions = await handle.payload.findGlobalVersions({
        slug: "about-page",
        pagination: false,
        overrideAccess: true,
        sort: "-updatedAt",
      });
      const first = versions.docs.find((row) => row.version?.slug === "first");
      if (!first) throw new Error("First Global version was not saved");

      await handle.payload.restoreGlobalVersion({
        slug: "about-page",
        id: first.id,
        overrideAccess: true,
      });

      const global = await handle.payload.findGlobal({
        slug: "about-page",
        draft: true,
        overrideAccess: true,
      });
      expect(global.slug).toBe("first");
      expect(global._status).toBe("published");
      expect(await redirectRows(handle.payload)).toEqual([["/second", "/first", "auto"]]);
    });
  });
});
