import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import type { CollectionConfig } from "payload";
import { versionedArticlesCollection } from "../helpers/factories/versioned-document";
import {
  createRedirectIntPayload,
  draftVersions,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from "../helpers/payload-harness";

const rows = async (handle: RedirectIntHandle) =>
  (
    await handle.payload.find({ collection: "redirects", overrideAccess: true, pagination: false })
  ).docs.map((doc) => [doc.from, doc.to, doc.origin]);

/** A consumer hook that runs before the plugin's and removes updatedAt from the document it returns. */
const stripUpdatedAt = (): CollectionConfig["hooks"] => ({
  afterChange: [
    ({ doc }) => {
      const { updatedAt: _ignored, ...rest } = doc as Record<string, unknown>;
      return rest as typeof doc;
    },
  ],
});

describe.skipIf(!intDatabaseConfigured)("publication identity sources", () => {
  let handle: RedirectIntHandle;

  beforeAll(async () => {
    const articles = versionedArticlesCollection();
    handle = await createRedirectIntPayload({
      collections: [
        {
          ...articles,
          versions: { drafts: { ...draftVersions.drafts } },
          hooks: stripUpdatedAt(),
        },
      ],
    });
  }, 120_000);

  afterAll(async () => {
    await handle.destroy();
  });

  beforeEach(async () => {
    await handle.resetArticles();
    await handle.resetRedirects();
  });

  it("a consumer afterChange hook that removes updatedAt does not lose the redirect", async () => {
    const created = await handle.payload.create({
      collection: "articles",
      data: { slug: "a", title: "A", _status: "published" },
      overrideAccess: true,
    });
    await handle.payload.update({
      collection: "articles",
      id: created.id,
      data: { slug: "b", _status: "published" },
      overrideAccess: true,
    });

    expect(await rows(handle)).toEqual([["/a", "/b", "auto"]]);
  });

  it("a Local API publish with a restricted select still creates the redirect", async () => {
    const created = await handle.payload.create({
      collection: "articles",
      data: { slug: "c", title: "C", _status: "published" },
      overrideAccess: true,
    });
    await handle.payload.update({
      collection: "articles",
      id: created.id,
      data: { slug: "d", _status: "published" },
      select: { slug: true },
      overrideAccess: true,
    });

    expect(await rows(handle)).toEqual([["/c", "/d", "auto"]]);
  });

  it("rapid consecutive publications link every step, even when timestamps may coincide", async () => {
    const created = await handle.payload.create({
      collection: "articles",
      data: { slug: "s0", title: "S", _status: "published" },
      overrideAccess: true,
    });
    for (let index = 1; index <= 12; index += 1) {
      await handle.payload.update({
        collection: "articles",
        id: created.id,
        data: { slug: `s${index}`, _status: "published" },
        overrideAccess: true,
      });
    }

    const expected = Array.from({ length: 12 }, (_, index) => [
      `/s${index}`,
      `/s${index + 1}`,
      "auto",
    ]);
    // Rows come back sorted by the `from` text, so compare as sets of pairs.
    const byPair = (list: unknown[][]) => list.map((row) => row.join(" ")).sort();
    expect(byPair(await rows(handle))).toEqual(byPair(expected));
  });
});
