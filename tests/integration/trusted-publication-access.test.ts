import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { CollectionConfig } from "payload";
import { versionedArticlesCollection } from "../helpers/factories/versioned-document";
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from "../helpers/payload-harness";

type TestUser = { id: string; role: "admin" | "publisher" | "reader" };

const admin: TestUser = { id: "admin-1", role: "admin" };
const publisher: TestUser = { id: "publisher-1", role: "publisher" };
const reader: TestUser = { id: "reader-1", role: "reader" };

/**
 * Publication authority lives on the tracked collection, not on the redirects collection. A publisher
 * may edit articles but cannot manage or read redirect rules. Automatic generation still runs for
 * that publisher through the plugin's trusted Local API writes.
 */
const articles = (): CollectionConfig => {
  const base = versionedArticlesCollection();
  return {
    ...base,
    access: {
      read: () => true,
      create: ({ req }) => req.user?.role === "publisher" || req.user?.role === "admin",
      update: ({ req }) => req.user?.role === "publisher" || req.user?.role === "admin",
      delete: () => false,
    },
  };
};

describe.skipIf(!intDatabaseConfigured)("trusted automatic publication under native access", () => {
  let handle: RedirectIntHandle;

  beforeAll(async () => {
    handle = await createRedirectIntPayload({
      collections: [articles()],
      redirectOverrides: {
        access: {
          read: ({ req }) => req.user?.role === "admin",
          create: ({ req }) => req.user?.role === "admin",
          update: ({ req }) => req.user?.role === "admin",
          delete: ({ req }) => req.user?.role === "admin",
        },
      },
    });
  }, 120_000);

  afterAll(async () => {
    await handle.destroy();
  });

  const createPublishedArticle = async (slug: string) => {
    await handle.resetArticles();
    await handle.resetRedirects();
    return handle.payload.create({
      collection: "articles",
      data: { slug, title: slug, _status: "published" },
      overrideAccess: true,
    });
  };

  it("a publisher without redirect permissions triggers a 301 rule on a published slug change", async () => {
    const created = await createPublishedArticle("first");

    await handle.payload.update({
      collection: "articles",
      id: created.id,
      data: { slug: "second", _status: "published" },
      overrideAccess: false,
      user: publisher as never,
    });

    const { docs } = await handle.payload.find({
      collection: "redirects",
      overrideAccess: true,
    });
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ from: "/first", to: "/second", origin: "auto" });
    expect(String(docs[0]?.statusCode)).toBe("301");

    // The publisher cannot read the rule directly, so the automatic write is the only path that made it.
    await expect(
      handle.payload.find({
        collection: "redirects",
        overrideAccess: false,
        user: publisher as never,
      }),
    ).rejects.toThrow();
    await expect(
      handle.payload.create({
        collection: "redirects",
        data: { from: "/publisher-manual", to: "/target" },
        overrideAccess: false,
        user: publisher as never,
      }),
    ).rejects.toThrow();
  });

  it("a reader without publication rights cannot change a tracked slug, so no rule is generated", async () => {
    const created = await createPublishedArticle("guarded");

    await expect(
      handle.payload.update({
        collection: "articles",
        id: created.id,
        data: { slug: "changed", _status: "published" },
        overrideAccess: false,
        user: reader as never,
      }),
    ).rejects.toThrow();

    const { totalDocs } = await handle.payload.find({
      collection: "redirects",
      overrideAccess: true,
    });
    expect(totalDocs).toBe(0);
  });

  it("origin in incoming data cannot impersonate an automatic write", async () => {
    await handle.resetRedirects();

    const created = await handle.payload.create({
      collection: "redirects",
      data: { from: "/forged", to: "/target", origin: "auto" } as never,
      overrideAccess: false,
      user: admin as never,
    });
    expect(created.origin).toBe("manual");

    const updated = await handle.payload.update({
      collection: "redirects",
      id: created.id,
      data: { origin: "auto", to: "/target-2" } as never,
      overrideAccess: false,
      user: admin as never,
    });
    expect(updated.origin).toBe("manual");
  });

  it("anonymous requests cannot write redirect rules through REST", async () => {
    await handle.resetRedirects();
    const { handleEndpoints } = await import("payload");
    const response = await handleEndpoints({
      config: handle.payload.config,
      payloadInstanceCacheKey: handle.payload.secret,
      request: new Request("http://localhost/api/redirects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: "/rest-forged", to: "/target", origin: "auto" }),
      }),
    });

    expect(response.status).toBeGreaterThanOrEqual(401);
    expect(response.status).toBeLessThan(500);
    const { totalDocs } = await handle.payload.find({
      collection: "redirects",
      overrideAccess: true,
    });
    expect(totalDocs).toBe(0);
  });
});
