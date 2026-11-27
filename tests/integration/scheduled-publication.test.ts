import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import type { GlobalConfig } from "payload";
import { versionedArticlesCollection } from "../helpers/factories/versioned-document";
import {
  createRedirectIntPayload,
  draftVersions,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from "../helpers/payload-harness";

const JOBS = "payload-jobs" as const;

const scheduledArticles = () => {
  const articles = versionedArticlesCollection();
  return {
    ...articles,
    versions: { drafts: { ...draftVersions.drafts, schedulePublish: true } },
  };
};

const aboutGlobal: GlobalConfig = {
  slug: "about",
  versions: { drafts: { ...draftVersions.drafts, schedulePublish: true } },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", required: true },
  ],
  custom: { redirect: { path: "/[slug]" } },
};

/**
 * Scheduling is Payload's native `schedulePublish` job. Each test isolates its own queue and asserts
 * the job's own status (`completedAt`, `hasError`, `error`) so that a passing run means the job ran.
 */
describe.skipIf(!intDatabaseConfigured)("native scheduled publication", () => {
  let handle: RedirectIntHandle;

  beforeAll(async () => {
    handle = await createRedirectIntPayload({
      collections: [scheduledArticles()],
      globals: [aboutGlobal],
    });
  }, 120_000);

  afterAll(async () => {
    await handle.destroy();
  });

  beforeEach(async () => {
    await handle.resetArticles();
    await handle.resetRedirects();
    const jobs = await handle.payload.find({
      collection: JOBS,
      limit: 500,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    });
    for (const job of jobs.docs) {
      await handle.payload.delete({ collection: JOBS, id: job.id, overrideAccess: true });
    }
  });

  const publishedArticle = (slug: string) =>
    handle.payload.create({
      collection: "articles",
      data: { slug, title: slug, _status: "published" },
      overrideAccess: true,
    });

  const draftSlugChange = (id: string | number, slug: string) =>
    handle.payload.update({
      collection: "articles",
      id,
      data: { slug },
      draft: true,
      overrideAccess: true,
    });

  const queueArticle = (id: string | number, type: "publish" | "unpublish") =>
    handle.payload.jobs.queue({
      task: "schedulePublish",
      input: { type, doc: { relationTo: "articles", value: String(id) } },
    });

  // Successful jobs are deleted on completion, so their status comes from the run result itself.
  const runStatus = async (id: string | number) => {
    const { jobStatus } = await handle.payload.jobs.run({ limit: 10 });
    return jobStatus?.[String(id)]?.status;
  };

  // Failed jobs keep their row, which records the error.
  const failedJobRow = (id: string | number) =>
    handle.payload.findByID({ collection: JOBS, id, depth: 0, overrideAccess: true });

  const redirects = () => handle.payload.find({ collection: "redirects", overrideAccess: true });

  const articleRow = (id: string | number) =>
    handle.payload.findByID({ collection: "articles", id, draft: true, overrideAccess: true });

  it("scheduling a publish creates no rule until the job runs", async () => {
    const created = await publishedArticle("first");
    await draftSlugChange(created.id, "second");

    await queueArticle(created.id, "publish");

    expect((await redirects()).totalDocs).toBe(0);
  });

  it("a scheduled Collection publish that changes the path publishes and generates exactly one 301", async () => {
    const created = await publishedArticle("first");
    await draftSlugChange(created.id, "second");
    const job = await queueArticle(created.id, "publish");

    expect(await runStatus(job.id)).toBe("success");

    expect((await articleRow(created.id)).slug).toBe("second");
    const { docs } = await redirects();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ from: "/first", to: "/second", origin: "auto" });
    expect(String(docs[0]?.statusCode)).toBe("301");
  });

  it("a scheduled Global publish that changes the path generates exactly one 301", async () => {
    await handle.payload.updateGlobal({
      slug: "about",
      data: { title: "About", slug: "about", _status: "published" },
      overrideAccess: true,
    });
    await handle.payload.updateGlobal({
      slug: "about",
      data: { slug: "about-us" },
      draft: true,
      overrideAccess: true,
    });

    const job = await handle.payload.jobs.queue({
      task: "schedulePublish",
      input: { type: "publish", global: "about" },
    });
    expect(await runStatus(job.id)).toBe("success");
    const { docs } = await redirects();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ from: "/about", to: "/about-us", origin: "auto" });
  });

  it("a scheduled unpublish completes and creates no new rule", async () => {
    const created = await publishedArticle("first");

    const job = await queueArticle(created.id, "unpublish");
    expect(await runStatus(job.id)).toBe("success");
    expect((await articleRow(created.id))._status).toBe("draft");
    expect((await redirects()).totalDocs).toBe(0);
  });

  it("deleting the document cancels its pending scheduled job, so nothing publishes", async () => {
    const created = await publishedArticle("first");
    await draftSlugChange(created.id, "second");
    const job = await queueArticle(created.id, "publish");

    await handle.payload.delete({ collection: "articles", id: created.id, overrideAccess: true });
    // The cancelled job is removed with the document, so the queue has nothing to run for it.
    expect(await runStatus(job.id)).toBeUndefined();
    await expect(failedJobRow(job.id)).rejects.toThrow();
    expect((await redirects()).totalDocs).toBe(0);
  });

  it("a scheduled publish rejected by redirect validation fails, rolls back, and leaves the graph unchanged", async () => {
    const created = await publishedArticle("first");
    // A manual rule that points back to the path the publish would create: /second -> /first.
    await handle.payload.create({
      collection: "redirects",
      data: { from: "/second", to: "/first", statusCode: 301, enabled: true },
      overrideAccess: true,
    });
    await draftSlugChange(created.id, "second");

    const job = await queueArticle(created.id, "publish");
    expect(await runStatus(job.id)).toBe("error-reached-max-retries");

    const row = await failedJobRow(job.id);
    expect(row.hasError).toBe(true);
    expect(row.completedAt).toBeFalsy();
    expect(JSON.stringify(row.error)).toContain("The following field is invalid: to");

    // Rollback: the published slug stays "first" and the only rule is the manual one.
    const published = await handle.payload.findByID({
      collection: "articles",
      id: created.id,
      overrideAccess: true,
    });
    expect(published.slug).toBe("first");
    const { docs } = await redirects();
    expect(docs.map((doc) => [doc.from, doc.to, doc.origin])).toEqual([
      ["/second", "/first", "manual"],
    ]);
  });

  it("a scheduled publish of a missing document records a real job failure and no rule", async () => {
    await publishedArticle("first");

    const job = await handle.payload.jobs.queue({
      task: "schedulePublish",
      input: { type: "publish", doc: { relationTo: "articles", value: "does-not-exist" } },
    });
    expect(await runStatus(job.id)).toBe("error-reached-max-retries");

    const row = await failedJobRow(job.id);
    expect(row.hasError).toBe(true);
    expect(JSON.stringify(row.error)).toContain("Not Found");
    expect((await redirects()).totalDocs).toBe(0);
  });
});
