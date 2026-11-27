import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { configToSchema } from "@payloadcms/graphql";
import { graphql as graphqlExecute } from "graphql";
import { createLocalReq, getPayload, type Payload } from "payload";
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from "../helpers/payload-harness";
import { closeTestPostgresPool } from "../helpers/test-postgres";

const closeHttpPayload = async (payload: Payload) => {
  const httpPayload = await getPayload({ config: payload.config, key: payload.secret });
  // The cached instance is the fixture's own instance: closing it would end the pool still in use.
  if (httpPayload === payload) return;
  await httpPayload.db.destroy?.();
  const pool = (httpPayload.db as unknown as { pool?: Parameters<typeof closeTestPostgresPool>[0] })
    .pool;
  if (pool) await closeTestPostgresPool(pool);
};

const graphql = async (payload: Payload, query: string) => {
  // The native schema and resolvers that the Payload GraphQL route executes, without the Next.js route.
  const { schema } = configToSchema(payload.config);
  const req = await createLocalReq({}, payload);
  const result = await graphqlExecute({ schema, source: query, contextValue: { req } });
  return {
    status: 200,
    body: result as { data?: Record<string, unknown> | null; errors?: Array<{ message: string }> },
  };
};

const DOCS_QUERY = "{ Redirects { docs { id from to origin } } }";
const READABLE_QUERY = "{ Redirects { docs { id to origin } } }";
const FROM_QUERY = "{ Redirects { docs { from } } }";

/**
 * GraphQL runs through the same native access functions as REST and Local API. Anonymous requests see
 * nothing by default, and an explicit public read exposes only the fields that remain readable.
 */
describe.skipIf(!intDatabaseConfigured)("native redirects access through GraphQL", () => {
  let handle: RedirectIntHandle;

  beforeAll(async () => {
    handle = await createRedirectIntPayload();
  }, 120_000);

  afterAll(async () => {
    await handle.destroy();
  });

  it("anonymous GraphQL reads are refused by the default collection access", async () => {
    await handle.resetRedirects();
    await handle.payload.create({
      collection: "redirects",
      data: { from: "/gql-default", to: "/target" },
      overrideAccess: true,
    });

    const { status, body } = await graphql(handle.payload, DOCS_QUERY);
    await closeHttpPayload(handle.payload);

    expect(status).toBeLessThan(500);
    expect(body.errors?.length ?? 0).toBeGreaterThan(0);
    expect(body.data?.Redirects ?? null).toBeNull();
  });

  it("anonymous GraphQL mutations are refused", async () => {
    const { status, body } = await graphql(
      handle.payload,
      'mutation { createRedirect(data: { from: "/gql-anon", to: "/target" }) { id } }',
    );
    await closeHttpPayload(handle.payload);

    expect(status).toBeLessThan(500);
    expect(body.errors?.length ?? 0).toBeGreaterThan(0);
    const { totalDocs } = await handle.payload.find({
      collection: "redirects",
      where: { from: { equals: "/gql-anon" } },
      overrideAccess: true,
    });
    expect(totalDocs).toBe(0);
  });

  it("explicit public read returns documents through GraphQL when every field is readable", async () => {
    await handle.destroy();
    handle = await createRedirectIntPayload({
      redirectOverrides: { access: { read: () => true } },
    });
    await handle.payload.create({
      collection: "redirects",
      data: { from: "/gql-public", to: "/target" },
      overrideAccess: true,
    });

    const result = await graphql(handle.payload, READABLE_QUERY);
    await closeHttpPayload(handle.payload);

    const doc = (
      result.body.data?.Redirects as { docs: Array<Record<string, unknown>> } | undefined
    )?.docs[0];
    expect(doc?.to).toBe("/target");
    expect(doc?.origin).toBe("manual");
  });

  it("a field without read access makes every GraphQL query on the collection fail", async () => {
    await handle.destroy();
    handle = await createRedirectIntPayload({
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

    const fromQuery = await graphql(handle.payload, FROM_QUERY);
    const readableQuery = await graphql(handle.payload, READABLE_QUERY);
    await closeHttpPayload(handle.payload);

    // Native Payload behavior: the plugin does not weaken or override field access for GraphQL.
    expect(fromQuery.body.errors?.[0]?.message).toContain("cannot be queried: from");
    expect(readableQuery.body.errors?.[0]?.message).toContain("cannot be queried: from");
    expect(readableQuery.body.data?.Redirects ?? null).toBeNull();
  });
});
