import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { NextRequest, NextResponse } from "next/server";
import { getPayload, type Payload, type SanitizedConfig } from "payload";
import { closeTestPostgresPool } from "../helpers/test-postgres";
import { createManualRedirect } from "../helpers/factories/redirect";
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from "../helpers/payload-harness";

// The function bodies are the README "Application integration" example. The only change is the config:
// the test passes the fixture config instead of the `@payload-config` alias.
function normalizeRequestPath(pathname: string): string {
  const collapsed = pathname.replace(/\/{2,}/g, "/");
  return collapsed.length > 1 && collapsed.endsWith("/") ? collapsed.slice(0, -1) : collapsed;
}

const makeProxy = (payloadConfig: SanitizedConfig) =>
  async function proxy(request: NextRequest) {
    const { search } = request.nextUrl;
    const from = normalizeRequestPath(request.nextUrl.pathname) + search;

    const payload = await getPayload({ config: payloadConfig });
    const { docs } = await payload.find({
      collection: "redirects",
      where: {
        and: [{ from: { equals: from } }, { enabled: { equals: true } }],
      },
      limit: 1,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    });

    const rule = docs[0];
    if (!rule) return NextResponse.next();

    // Never redirect a request to the URL it already has.
    const target = new URL(rule.to, request.url);
    if (target.pathname + target.search === from) return NextResponse.next();

    return NextResponse.redirect(target, Number(rule.statusCode) as 301 | 302);
  };

describe.skipIf(!intDatabaseConfigured)("Next.js proxy example from the README", () => {
  let handle: RedirectIntHandle;
  let proxy: (request: NextRequest) => Promise<NextResponse>;
  let defaultInstance: Payload | undefined;

  beforeAll(async () => {
    handle = await createRedirectIntPayload();
    await createManualRedirect(handle.payload, { from: "/old", to: "/new" });
    await createManualRedirect(handle.payload, {
      from: "/campaign?ref=sms",
      to: "/landing",
      statusCode: 302,
    });
    await createManualRedirect(handle.payload, { from: "/gone", to: "/home", enabled: false });
    proxy = makeProxy(handle.payload.config);
  }, 120_000);

  afterAll(async () => {
    // The example's keyless getPayload() caches a second instance on the same database. Close its pool before
    // the fixture drops the database, so no idle connection survives into the DROP.
    if (handle) {
      defaultInstance = await getPayload({ config: handle.payload.config });
      if (defaultInstance !== handle.payload) {
        const pool = (
          defaultInstance.db as unknown as { pool?: Parameters<typeof closeTestPostgresPool>[0] }
        ).pool;
        await defaultInstance.db.destroy?.();
        if (pool) await closeTestPostgresPool(pool);
      }
      await handle.destroy();
    }
  });

  const request = (path: string) => new NextRequest(`http://localhost${path}`);
  const isPassThrough = (response: Response) => response.headers.get("x-middleware-next") === "1";

  it("redirects an exact path with its stored status code and an absolute Location", async () => {
    const response = await proxy(request("/old"));
    expect(isPassThrough(response)).toBe(false);
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("http://localhost/new");
  });

  it("normalizes repeated and trailing slashes before matching", async () => {
    const response = await proxy(request("/old//"));
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("http://localhost/new");
  });

  it("matches the query string exactly and honors a 302 rule", async () => {
    const withQuery = await proxy(request("/campaign?ref=sms"));
    expect(withQuery.status).toBe(302);
    expect(withQuery.headers.get("location")).toBe("http://localhost/landing");

    const otherQuery = await proxy(request("/campaign?ref=email"));
    expect(isPassThrough(otherQuery)).toBe(true);

    const bare = await proxy(request("/campaign"));
    expect(isPassThrough(bare)).toBe(true);
  });

  it("passes through disabled rules and unknown paths", async () => {
    expect(isPassThrough(await proxy(request("/gone")))).toBe(true);
    expect(isPassThrough(await proxy(request("/unknown")))).toBe(true);
  });
});
