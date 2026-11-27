import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from "../helpers/payload-harness";

const createRule = (handle: RedirectIntHandle, data: Record<string, unknown>) =>
  handle.payload.create({
    collection: "redirects",
    data: { statusCode: 301, enabled: true, ...data },
    overrideAccess: true,
  });

const rejects = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
  } catch (error) {
    const errors = (error as { data?: { errors?: Array<{ message: string }> } }).data?.errors;
    return errors?.map((item) => item.message).join(" ") ?? String(error);
  }
  throw new Error("expected the write to be rejected");
};

/** Manual campaign and query-string rules use the existing exact-match rule model. */
describe.skipIf(!intDatabaseConfigured)("manual rules with query strings (postgres)", () => {
  let handle: RedirectIntHandle;

  beforeAll(async () => {
    handle = await createRedirectIntPayload();
  }, 120_000);

  afterAll(async () => {
    await handle.destroy();
  });

  beforeEach(async () => {
    await handle.resetRedirects();
  });

  it("stores a campaign redirect that adds attribution parameters to the same pathname", async () => {
    const campaignTo = "/summer-2027?utm_source=sms&utm_medium=sms&utm_campaign=summer_2027";
    const rule = await createRule(handle, {
      from: "/summer-2027",
      to: campaignTo,
      statusCode: 302,
    });

    expect(rule.from).toBe("/summer-2027");
    expect(rule.to).toBe(campaignTo);
    expect(String(rule.statusCode)).toBe("302");
  });

  it("keeps query-specific sources distinct from the bare pathname and from each other", async () => {
    await createRule(handle, { from: "/campaign", to: "/offers" });
    await createRule(handle, { from: "/campaign?ref=sms", to: "/offers?utm_source=sms" });
    await createRule(handle, { from: "/campaign?ref=email", to: "/offers?utm_source=email" });
    await createRule(handle, { from: "/campaign?ref=sms&lang=en", to: "/offers?lang=en" });

    const duplicate = await rejects(createRule(handle, { from: "/campaign?ref=sms", to: "/x" }));
    expect(duplicate).toContain("already exists");
  });

  it("does not canonicalize query parameter order or encoding", async () => {
    await createRule(handle, { from: "/search?a=1&b=2", to: "/results" });
    await createRule(handle, { from: "/search?b=2&a=1", to: "/results" });
    await createRule(handle, { from: "/search?q=caf%C3%A9", to: "/results" });

    const stored = await handle.payload.find({
      collection: "redirects",
      where: { from: { contains: "/search?" } },
      limit: 10,
      depth: 0,
      overrideAccess: true,
    });
    expect(stored.docs.map((doc) => doc.from).sort()).toEqual([
      "/search?a=1&b=2",
      "/search?b=2&a=1",
      "/search?q=caf%C3%A9",
    ]);
  });

  it("accepts a same-pathname redirect that only adds query parameters", async () => {
    const rule = await createRule(handle, {
      from: "/summer-2027",
      to: "/summer-2027?utm_source=sms",
      statusCode: 302,
    });
    expect(rule.to).toBe("/summer-2027?utm_source=sms");
  });

  it("accepts a query-specific redirect to a different path", async () => {
    const rule = await createRule(handle, {
      from: "/campaign?ref=sms",
      to: "/offers?utm_source=sms",
    });
    expect(rule.to).toBe("/offers?utm_source=sms");
  });

  it("detects a cycle that only exists through query-specific rules", async () => {
    await createRule(handle, { from: "/promo?src=a", to: "/promo" });

    const error = await rejects(createRule(handle, { from: "/promo", to: "/promo?src=a" }));
    expect(error).toContain("back to this source path");
  });

  it("keeps a disabled query-specific rule out of the cycle check", async () => {
    await createRule(handle, { from: "/promo?src=a", to: "/promo", enabled: false });

    const rule = await createRule(handle, { from: "/promo", to: "/promo?src=a" });
    expect(rule.to).toBe("/promo?src=a");
  });

  it("rejects a source that contains a fragment", async () => {
    const error = await rejects(createRule(handle, { from: "/guide#top", to: "/guides" }));
    expect(error).toContain("fragment");
  });

  it("accepts destination fragments", async () => {
    const rule = await createRule(handle, {
      from: "/old-guide",
      to: "/guides/getting-started#installation",
    });
    expect(rule.to).toBe("/guides/getting-started#installation");
  });
});
