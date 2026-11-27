import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { configToSchema } from "@payloadcms/graphql";
import { graphql as graphqlExecute } from "graphql";
import {
  type CollectionConfig,
  createLocalReq,
  getPayload,
  handleEndpoints,
  type Payload,
} from "payload";
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from "../helpers/payload-harness";
import { closeTestPostgresPool } from "../helpers/test-postgres";

const PASSWORD = "correct-horse-battery-staple";
const DENIED = "You are not allowed to perform this action.";

const usersCollection: CollectionConfig = {
  slug: "users",
  auth: true,
  fields: [
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "reader",
      options: ["admin", "reader"],
    },
  ],
};

/**
 * An ordinary Payload collection with the same fields as the plugin's collection and no access
 * configuration. Every operation below runs against both collections; the outcomes must match.
 */
const plainRedirects: CollectionConfig = {
  slug: "plain-redirects",
  fields: [
    { name: "from", type: "text", required: true, unique: true },
    { name: "to", type: "text", required: true },
    {
      name: "statusCode",
      type: "select",
      defaultValue: "301",
      options: [
        { label: "301", value: "301" },
        { label: "302", value: "302" },
      ],
    },
    { name: "enabled", type: "checkbox", defaultValue: true },
    {
      name: "origin",
      type: "select",
      defaultValue: "manual",
      options: ["manual", "auto"],
    },
  ],
};

/**
 * Differential coverage of native access. The plugin's collection must behave exactly like the ordinary
 * one for anonymous and authenticated users, over REST, Local API, and GraphQL.
 */
describe.skipIf(!intDatabaseConfigured)(
  "plugin collection matches an ordinary Payload collection",
  () => {
    let handle: RedirectIntHandle;
    const tokens: Partial<Record<"admin" | "reader", string>> = {};

    const rest = async (
      path: string,
      method: string,
      token?: string,
      body?: Record<string, unknown>,
    ) => {
      const headers: Record<string, string> = {};
      if (body) headers["content-type"] = "application/json";
      if (token) headers.authorization = `JWT ${token}`;
      const response = await handleEndpoints({
        config: handle.payload.config,
        payloadInstanceCacheKey: handle.payload.secret,
        request: new Request(`http://localhost/api${path}`, {
          method,
          headers,
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
      });
      const json = (await response.json()) as Record<string, unknown>;
      return {
        status: response.status,
        error: (json.errors as Array<{ message: string }> | undefined)?.[0]?.message,
      };
    };

    const graphql = async (token: string | undefined, source: string) => {
      const { schema } = configToSchema(handle.payload.config);
      const { user } = await handle.payload.auth({
        headers: new Headers(token ? { authorization: `JWT ${token}` } : {}),
        canSetHeaders: false,
      });
      const req = await createLocalReq({ user: user ?? undefined }, handle.payload);
      const result = (await graphqlExecute({ schema, source, contextValue: { req } })) as {
        data?: Record<string, unknown> | null;
        errors?: Array<{ message: string }>;
      };
      return { denied: result.errors?.[0]?.message === DENIED, errors: result.errors?.length ?? 0 };
    };

    const localOutcome = async (
      collection: "redirects" | "plain-redirects",
      operation: "find" | "create" | "update" | "delete",
      user?: { id: string; role: string },
    ) => {
      try {
        if (operation === "find") {
          await handle.payload.find({
            collection,
            overrideAccess: false,
            user: user as never,
            limit: 1,
          });
        } else if (operation === "create") {
          await handle.payload.create({
            collection,
            data: { from: `/local-${Math.random()}`, to: "/target" },
            overrideAccess: false,
            user: user as never,
          });
        } else {
          const { docs } = await handle.payload.find({
            collection,
            overrideAccess: true,
            limit: 1,
          });
          const id = docs[0]?.id;
          if (operation === "update") {
            await handle.payload.update({
              collection,
              id: id!,
              data: { to: "/changed" },
              overrideAccess: false,
              user: user as never,
            });
          } else {
            await handle.payload.delete({
              collection,
              id: id!,
              overrideAccess: false,
              user: user as never,
            });
          }
        }
        return "allowed";
      } catch (error) {
        return (error as { name?: string }).name === "Forbidden" ||
          /not allowed|Forbidden/.test(String(error))
          ? "denied"
          : `error:${String(error)}`;
      }
    };

    beforeAll(async () => {
      handle = await createRedirectIntPayload({ collections: [usersCollection, plainRedirects] });
      for (const role of ["admin", "reader"] as const) {
        await handle.payload.create({
          collection: "users",
          data: { email: `${role}@example.test`, password: PASSWORD, role },
          overrideAccess: true,
        });
        const login = await rest("/users/login", "POST", undefined, {
          email: `${role}@example.test`,
          password: PASSWORD,
        });
        expect(login.status).toBe(200);
        const body = await handle.payload.login({
          collection: "users",
          data: { email: `${role}@example.test`, password: PASSWORD },
          overrideAccess: true,
        });
        tokens[role] = body.token ?? undefined;
      }
    }, 120_000);

    afterAll(async () => {
      const httpPayload = await getPayload({
        config: handle.payload.config,
        key: handle.payload.secret,
      });
      if (httpPayload !== handle.payload) {
        await httpPayload.db.destroy?.();
        const pool = (
          httpPayload.db as unknown as { pool?: Parameters<typeof closeTestPostgresPool>[0] }
        ).pool;
        if (pool) await closeTestPostgresPool(pool);
      }
      await handle.destroy();
    });

    it("anonymous and authenticated REST outcomes are identical for both collections", async () => {
      const seed = async (collection: "redirects" | "plain-redirects") =>
        handle.payload.create({
          collection,
          data: { from: "/seed", to: "/target" },
          overrideAccess: true,
        });
      await seed("redirects");
      await seed("plain-redirects");

      const paths = [
        ["GET", "/{c}"],
        ["POST", "/{c}"],
      ] as const;
      for (const token of [undefined, tokens.reader, tokens.admin]) {
        for (const [method, template] of paths) {
          const body =
            method === "POST" ? { from: `/rest-${Math.random()}`, to: "/target" } : undefined;
          const plain = await rest(template.replace("{c}", "plain-redirects"), method, token, body);
          const own = await rest(template.replace("{c}", "redirects"), method, token, body);
          expect(own.status).toBe(plain.status);
          expect(own.error).toBe(plain.error);
        }
      }
    });

    it("Local API outcomes are identical for anonymous and authenticated users", async () => {
      const reader = { id: "reader", role: "reader" };
      const admin = { id: "admin", role: "admin" };
      for (const user of [undefined, reader, admin]) {
        for (const operation of ["find", "create", "update", "delete"] as const) {
          const own = await localOutcome("redirects", operation, user);
          const plain = await localOutcome("plain-redirects", operation, user);
          expect(own).toBe(plain);
        }
      }
    });

    it("GraphQL reads and mutations behave like the ordinary collection", async () => {
      const readOwn = await graphql(undefined, "{ Redirects { totalDocs } }");
      const readPlain = await graphql(undefined, "{ PlainRedirects { totalDocs } }");
      expect(readOwn.denied).toBe(readPlain.denied);
      expect(readOwn.denied).toBe(true);

      const createOwn = await graphql(
        tokens.reader,
        'mutation { createRedirect(data: { from: "/gql-own", to: "/t", statusCode: _301, origin: manual }) { id } }',
      );
      const createPlain = await graphql(
        tokens.reader,
        'mutation { createPlainRedirect(data: { from: "/gql-plain", to: "/t", statusCode: _301, origin: manual }) { id } }',
      );
      expect(createOwn.denied).toBe(createPlain.denied);
      expect(createOwn.denied).toBe(false); // default access: any authenticated user may create, on both collections
    });
  },
);
