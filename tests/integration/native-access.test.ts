import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { getPayload, handleEndpoints, type CollectionConfig, type Payload } from "payload";
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from "../helpers/payload-harness";
import { closeTestPostgresPool } from "../helpers/test-postgres";

const nativeCollection: CollectionConfig = {
  slug: "native-access",
  fields: [{ name: "name", type: "text", required: true }],
};

const authenticatedUser = { id: "payload-redirect-test-user", type: "service" };

const closeHttpPayload = async (payload: Payload) => {
  const httpPayload = await getPayload({ config: payload.config, key: payload.secret });
  // Same cached instance as the fixture: closing it here would end the pool the test still uses.
  if (httpPayload === payload) return;
  await httpPayload.db.destroy?.();
  const pool = (
    httpPayload.db as unknown as {
      pool?: Parameters<typeof closeTestPostgresPool>[0];
    }
  ).pool;
  if (pool) await closeTestPostgresPool(pool);
};

describe.skipIf(!intDatabaseConfigured)("native redirects access", () => {
  let handle: RedirectIntHandle;

  beforeAll(async () => {
    handle = await createRedirectIntPayload({ collections: [nativeCollection] });
  }, 120_000);

  afterAll(async () => {
    await handle.destroy();
  });

  it("matches an ordinary Payload collection's default authenticated access", async () => {
    const { payload } = handle;
    const anonymousFind = (collection: "redirects" | "native-access") =>
      payload.find({ collection, limit: 1, overrideAccess: false });

    await expect(anonymousFind("redirects")).rejects.toThrow();
    await expect(anonymousFind("native-access")).rejects.toThrow();
    await expect(
      payload.create({
        collection: "redirects",
        data: { from: "/anonymous-create", to: "/target" },
        overrideAccess: false,
      }),
    ).rejects.toThrow();
    await expect(
      payload.create({
        collection: "native-access",
        data: { name: "anonymous" },
        overrideAccess: false,
      }),
    ).rejects.toThrow();

    const redirect = await payload.create({
      collection: "redirects",
      data: { from: "/native-access", to: "/target" },
      overrideAccess: false,
      user: authenticatedUser as never,
    });
    const native = await payload.create({
      collection: "native-access",
      data: { name: "native" },
      overrideAccess: false,
      user: authenticatedUser as never,
    });

    expect(
      await payload.find({
        collection: "redirects",
        overrideAccess: false,
        user: authenticatedUser as never,
      }),
    ).toMatchObject({ totalDocs: 1 });
    expect(
      await payload.find({
        collection: "native-access",
        overrideAccess: false,
        user: authenticatedUser as never,
      }),
    ).toMatchObject({ totalDocs: 1 });

    await expect(
      payload.update({
        collection: "redirects",
        id: redirect.id,
        data: { to: "/anonymous-update" },
        overrideAccess: false,
      }),
    ).rejects.toThrow();
    await expect(
      payload.update({
        collection: "native-access",
        id: native.id,
        data: { name: "anonymous-update" },
        overrideAccess: false,
      }),
    ).rejects.toThrow();

    await payload.update({
      collection: "redirects",
      id: redirect.id,
      data: { to: "/authenticated-update" },
      overrideAccess: false,
      user: authenticatedUser as never,
    });
    await payload.update({
      collection: "native-access",
      id: native.id,
      data: { name: "authenticated-update" },
      overrideAccess: false,
      user: authenticatedUser as never,
    });

    await expect(
      payload.delete({ collection: "redirects", id: redirect.id, overrideAccess: false }),
    ).rejects.toThrow();
    await expect(
      payload.delete({ collection: "native-access", id: native.id, overrideAccess: false }),
    ).rejects.toThrow();

    await payload.delete({
      collection: "redirects",
      id: redirect.id,
      overrideAccess: false,
      user: authenticatedUser as never,
    });
    await payload.delete({
      collection: "native-access",
      id: native.id,
      overrideAccess: false,
      user: authenticatedUser as never,
    });
  });

  it("enforces native collection access through REST requests", async () => {
    const { payload } = handle;
    const request = (
      path: string,
      method: string,
      body?: Record<string, unknown>,
    ): Promise<Response> =>
      handleEndpoints({
        config: payload.config,
        payloadInstanceCacheKey: payload.secret,
        request: new Request(`http://localhost/api${path}`, {
          method,
          ...(body
            ? {
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              }
            : {}),
        }),
      });

    const redirect = await payload.create({
      collection: "redirects",
      data: { from: "/http-access", to: "/target" },
      overrideAccess: true,
    });
    const native = await payload.create({
      collection: "native-access",
      data: { name: "http-access" },
      overrideAccess: true,
    });

    const requests = [
      ["/redirects", "GET"],
      ["/native-access", "GET"],
      ["/redirects", "POST", { from: "/anonymous", to: "/target" }],
      ["/native-access", "POST", { name: "anonymous" }],
      [`/redirects/${redirect.id}`, "PATCH", { to: "/anonymous-update" }],
      [`/native-access/${native.id}`, "PATCH", { name: "anonymous-update" }],
      [`/redirects/${redirect.id}`, "DELETE"],
      [`/native-access/${native.id}`, "DELETE"],
    ] as const;

    // Create the cached endpoint instance once. Concurrent first calls each build their own instance,
    // and any instance not closed here keeps a pool open into the database the fixture drops.
    await getPayload({ config: payload.config, key: payload.secret });
    const responses = await Promise.all(
      requests.map(([path, method, body]) => request(path, method, body)),
    );
    await closeHttpPayload(payload);
    for (let index = 0; index < responses.length; index += 2) {
      const [redirectResponse, nativeResponse] = responses.slice(index, index + 2);
      expect(redirectResponse?.status).toBe(nativeResponse?.status);
      expect(redirectResponse?.status).toBeGreaterThanOrEqual(400);
      expect(redirectResponse?.status).toBeLessThan(500);
    }
  });

  it("allows explicit public-read access without changing other native defaults", async () => {
    await handle.destroy();
    handle = await createRedirectIntPayload({
      collections: [nativeCollection],
      redirectOverrides: {
        access: { read: () => true },
        fields: ({ defaultFields }) =>
          defaultFields.map((field) =>
            "name" in field && field.name === "from"
              ? { ...field, access: { read: () => false } }
              : field,
          ),
      },
    });

    await handle.payload.create({
      collection: "redirects",
      data: { from: "/public-read", to: "/target" },
      overrideAccess: true,
    });

    const publicRead = await handle.payload.find({
      collection: "redirects",
      overrideAccess: false,
      limit: 1,
      sort: "id",
    });
    expect(publicRead.totalDocs).toBe(1);
    expect(publicRead.docs[0]?.from).toBeUndefined();
    const response = await handleEndpoints({
      config: handle.payload.config,
      payloadInstanceCacheKey: handle.payload.secret,
      request: new Request("http://localhost/api/redirects?limit=1&sort=id"),
    });
    await closeHttpPayload(handle.payload);
    const result = (await response.json()) as {
      docs?: Array<Record<string, unknown>>;
    };
    expect(response.status).toBe(200);
    expect(result.docs?.[0]?.from).toBeUndefined();
    await expect(
      handle.payload.create({
        collection: "redirects",
        data: { from: "/public-create", to: "/target" },
        overrideAccess: false,
      }),
    ).rejects.toThrow();
  });
});
