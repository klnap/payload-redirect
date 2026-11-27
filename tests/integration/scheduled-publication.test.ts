import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { versionedArticlesCollection } from "../helpers/factories/versioned-document";
import {
  createRedirectIntPayload,
  draftVersions,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from "../helpers/payload-harness";

/**
 * Scheduling is Payload's native `schedulePublish` job. The plugin reacts only when that job publishes,
 * because it hooks the native publication path. Scheduling itself must not create a rule.
 */
describe.skipIf(!intDatabaseConfigured)("native scheduled publication", () => {
  let handle: RedirectIntHandle;

  beforeAll(async () => {
    const articles = versionedArticlesCollection();
    handle = await createRedirectIntPayload({
      collections: [
        {
          ...articles,
          versions: { drafts: { ...draftVersions.drafts, schedulePublish: true } },
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

  const publishedArticle = async (slug: string) =>
    handle.payload.create({
      collection: "articles",
      data: { slug, title: slug, _status: "published" },
      overrideAccess: true,
    });

  const schedule = (id: string | number, type: "publish" | "unpublish") =>
    handle.payload.jobs.queue({
      task: "schedulePublish",
      input: { type, doc: { relationTo: "articles", value: String(id) } },
    });

  const runJobs = () => handle.payload.jobs.run({ limit: 10 });

  const redirects = () => handle.payload.find({ collection: "redirects", overrideAccess: true });

  it("scheduling a publish creates no rule until the job runs", async () => {
    const created = await publishedArticle("first");
    await handle.payload.update({
      collection: "articles",
      id: created.id,
      data: { slug: "second" },
      draft: true,
      overrideAccess: true,
    });

    await schedule(created.id, "publish");
    expect((await redirects()).totalDocs).toBe(0);
  });

  it("a scheduled publish that changes the path generates one 301 when the job runs", async () => {
    const created = await publishedArticle("first");
    await handle.payload.update({
      collection: "articles",
      id: created.id,
      data: { slug: "second" },
      draft: true,
      overrideAccess: true,
    });

    await schedule(created.id, "publish");
    await runJobs();

    const { docs } = await redirects();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ from: "/first", to: "/second", origin: "auto" });
    expect(String(docs[0]?.statusCode)).toBe("301");
  });

  it("a scheduled unpublish creates no new rule", async () => {
    const created = await publishedArticle("first");

    await schedule(created.id, "unpublish");
    await runJobs();

    expect((await redirects()).totalDocs).toBe(0);
  });

  it("a failed scheduled publish leaves no rule behind", async () => {
    const created = await publishedArticle("first");
    await handle.payload.update({
      collection: "articles",
      id: created.id,
      data: { slug: "second" },
      draft: true,
      overrideAccess: true,
    });

    await handle.payload.jobs.queue({
      task: "schedulePublish",
      input: { type: "publish", doc: { relationTo: "articles", value: "does-not-exist" } },
    });
    await runJobs().catch(() => undefined);

    expect((await redirects()).totalDocs).toBe(0);
  });
});
