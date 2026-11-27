import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
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

type Role = "admin" | "editor" | "reader";

const PASSWORD = "correct-horse-battery-staple";

const usersCollection: CollectionConfig = {
  slug: "users",
  auth: true,
  fields: [
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "reader",
      options: ["admin", "editor", "reader"],
    },
  ],
};

/**
 * Real Payload authentication: users log in through the native auth collection and send the JWT
 * they receive. Nothing injects a user into the HTTP request.
 */
describe.skipIf(!intDatabaseConfigured)(
  "authenticated REST and GraphQL access to redirects",
  () => {
    let handle: RedirectIntHandle;
    const tokens: Partial<Record<Role | "anonymous", string>> = {};
    const userIds: Partial<Record<Role, string | number>> = {};

    const closePool = async (payload: Payload) => {
      await payload.db.destroy?.();
      const pool = (payload.db as unknown as { pool?: Parameters<typeof closeTestPostgresPool>[0] })
        .pool;
      if (pool) await closeTestPostgresPool(pool);
    };

    const rest = async (
      path: string,
      method: string,
      role: Role | "anonymous",
      body?: Record<string, unknown>,
    ) => {
      const headers: Record<string, string> = {};
      if (body) headers["content-type"] = "application/json";
      const token = tokens[role];
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
      return {
        status: response.status,
        json: (await response.json()) as Record<string, unknown>,
      };
    };

    /** Executes a GraphQL document with the user that Payload's own JWT verification resolves. */
    const graphql = async (role: Role | "anonymous", source: string) => {
      const { schema } = configToSchema(handle.payload.config);
      const token = tokens[role];
      const headers = new Headers(token ? { authorization: `JWT ${token}` } : {});
      const { user } = await handle.payload.auth({ headers, canSetHeaders: false });
      const req = await createLocalReq({ user: user ?? undefined }, handle.payload);
      return graphqlExecute({ schema, source, contextValue: { req } }) as Promise<{
        data?: Record<string, unknown> | null;
        errors?: Array<{ message: string }>;
      }>;
    };

    const seedRedirect = (data: Record<string, unknown>) =>
      handle.payload.create({ collection: "redirects", data, overrideAccess: true });

    beforeAll(async () => {
      handle = await createRedirectIntPayload({
        collections: [usersCollection],
        redirectOverrides: {
          access: {
            // Any logged-in user may read; editors and readers see only enabled rules (document-level).
            read: ({ req }) => {
              if (req.user?.role === "admin") return true;
              if (req.user) return { enabled: { equals: true } };
              return false;
            },
            create: ({ req }) => req.user?.role === "admin",
            update: ({ req }) => req.user?.role === "admin" || req.user?.role === "editor",
            delete: ({ req }) => req.user?.role === "admin",
          },
          fields: ({ defaultFields }) =>
            defaultFields.map((field) =>
              "name" in field && field.name === "statusCode"
                ? ({
                    ...field,
                    access: {
                      // Field-level write restriction: only admins may change the status code.
                      update: ({ req }) => req.user?.role === "admin",
                    },
                  } as typeof field)
                : field,
            ),
        },
      });

      for (const role of ["admin", "editor", "reader"] as const) {
        const user = await handle.payload.create({
          collection: "users",
          data: { email: `${role}@example.test`, password: PASSWORD, role },
          overrideAccess: true,
        });
        userIds[role] = user.id;
      }
      for (const role of ["admin", "editor", "reader"] as const) {
        const login = await rest("/users/login", "POST", "anonymous", {
          email: `${role}@example.test`,
          password: PASSWORD,
        });
        expect(login.status).toBe(200);
        tokens[role] = login.json.token as string;
      }
    }, 120_000);

    afterAll(async () => {
      // handleEndpoints caches its own Payload instance; close its pool before the fixture drops the database.
      const httpPayload = await getPayload({
        config: handle.payload.config,
        key: handle.payload.secret,
      });
      if (httpPayload !== handle.payload) await closePool(httpPayload);
      await handle.destroy();
    });

    beforeEach(async () => {
      await handle.resetRedirects();
    });

    it("login issues a token only for valid credentials", async () => {
      const wrong = await rest("/users/login", "POST", "anonymous", {
        email: "admin@example.test",
        password: "wrong-password",
      });
      expect(wrong.status).toBe(401);
      expect(wrong.json.token).toBeUndefined();
    });

    it("anonymous REST requests are refused and persist nothing", async () => {
      await seedRedirect({ from: "/anon-existing", to: "/target", enabled: true });

      const list = await rest("/redirects", "GET", "anonymous");
      const create = await rest("/redirects", "POST", "anonymous", {
        from: "/anon-create",
        to: "/target",
      });

      expect(list.status).toBe(403);
      expect(create.status).toBe(403);
      expect(create.json.errors).toEqual([
        { message: "You are not allowed to perform this action." },
      ]);
      const { totalDocs } = await handle.payload.find({
        collection: "redirects",
        where: { from: { equals: "/anon-create" } },
        overrideAccess: true,
      });
      expect(totalDocs).toBe(0);
    });

    it("document-level read: admins see every rule, editors see only enabled rules", async () => {
      await seedRedirect({ from: "/live", to: "/a", enabled: true });
      await seedRedirect({ from: "/parked", to: "/b", enabled: false });

      const admin = await rest("/redirects?limit=10", "GET", "admin");
      const editor = await rest("/redirects?limit=10", "GET", "editor");

      expect(admin.json.totalDocs).toBe(2);
      const editorFrom = (editor.json.docs as Array<{ from: string }>).map((doc) => doc.from);
      expect(editor.json.totalDocs).toBe(1);
      expect(editorFrom).toEqual(["/live"]);
    });

    it("collection-level create is admin-only; a reader's create persists nothing", async () => {
      const readerCreate = await rest("/redirects", "POST", "reader", {
        from: "/reader-create",
        to: "/target",
      });
      const adminCreate = await rest("/redirects", "POST", "admin", {
        from: "/admin-create",
        to: "/target",
      });

      expect(readerCreate.status).toBe(403);
      expect(readerCreate.json.errors).toEqual([
        { message: "You are not allowed to perform this action." },
      ]);
      expect(adminCreate.status).toBe(201);

      const persisted = await handle.payload.find({
        collection: "redirects",
        overrideAccess: true,
        pagination: false,
      });
      expect(persisted.docs.map((doc) => doc.from)).toEqual(["/admin-create"]);
    });

    it("editors update allowed fields but a field-level restriction blocks statusCode", async () => {
      const rule = await seedRedirect({ from: "/edit-me", to: "/old", statusCode: 301 });

      const allowed = await rest(`/redirects/${rule.id}`, "PATCH", "editor", { to: "/new" });
      const blocked = await rest(`/redirects/${rule.id}`, "PATCH", "editor", { statusCode: 302 });

      expect(allowed.status).toBe(200);
      expect(blocked.status).toBe(200);
      const stored = await handle.payload.findByID({
        collection: "redirects",
        id: rule.id,
        overrideAccess: true,
      });
      expect(stored.to).toBe("/new");
      // The field-level denial silently drops the field, so the stored status is unchanged.
      expect(String(stored.statusCode)).toBe("301");
    });

    it("editors cannot delete, and deletion by an admin removes the rule", async () => {
      const rule = await seedRedirect({ from: "/delete-me", to: "/target" });

      const editorDelete = await rest(`/redirects/${rule.id}`, "DELETE", "editor");
      expect(editorDelete.status).toBe(403);
      expect(
        (await handle.payload.find({ collection: "redirects", overrideAccess: true })).totalDocs,
      ).toBe(1);

      const adminDelete = await rest(`/redirects/${rule.id}`, "DELETE", "admin");
      expect(adminDelete.status).toBe(200);
      expect(
        (await handle.payload.find({ collection: "redirects", overrideAccess: true })).totalDocs,
      ).toBe(0);
    });

    it("authenticated GraphQL reads follow the same document-level access", async () => {
      await seedRedirect({ from: "/gql-live", to: "/a", enabled: true });
      await seedRedirect({ from: "/gql-parked", to: "/b", enabled: false });

      const admin = await graphql("admin", "{ Redirects { totalDocs docs { from } } }");
      const editor = await graphql("editor", "{ Redirects { totalDocs docs { from } } }");

      expect(admin.errors).toBeUndefined();
      expect(editor.errors).toBeUndefined();
      expect((admin.data?.Redirects as { totalDocs: number }).totalDocs).toBe(2);
      expect((editor.data?.Redirects as { totalDocs: number }).totalDocs).toBe(1);
    });

    it("anonymous GraphQL reads fail on access, not on query validity", async () => {
      await seedRedirect({ from: "/gql-anon", to: "/a", enabled: true });

      const anonymous = await graphql("anonymous", "{ Redirects { totalDocs } }");

      expect(anonymous.errors?.[0]?.message).toBe("You are not allowed to perform this action.");
      expect(anonymous.data?.Redirects ?? null).toBeNull();
    });

    it("GraphQL mutations: a reader's create is refused, an admin's create persists", async () => {
      const readerCreate = await graphql(
        "reader",
        'mutation { createRedirect(data: { from: "/gql-reader", to: "/target", statusCode: _301, origin: manual }) { id } }',
      );
      const adminCreate = await graphql(
        "admin",
        'mutation { createRedirect(data: { from: "/gql-admin", to: "/target", statusCode: _301, origin: manual }) { id from } }',
      );

      expect(readerCreate.errors?.[0]?.message).toBe("You are not allowed to perform this action.");
      expect(readerCreate.data?.createRedirect ?? null).toBeNull();
      expect(adminCreate.errors).toBeUndefined();
      expect((adminCreate.data?.createRedirect as { from: string }).from).toBe("/gql-admin");

      const persisted = await handle.payload.find({
        collection: "redirects",
        overrideAccess: true,
      });
      expect(persisted.docs.map((doc) => doc.from)).toEqual(["/gql-admin"]);
    });

    it("an external request cannot forge origin through REST data", async () => {
      const created = await rest("/redirects", "POST", "admin", {
        from: "/forge-me",
        to: "/target",
        origin: "auto",
      });
      expect(created.status).toBe(201);
      const id = (created.json.doc as { id: string | number }).id;

      const forgedUpdate = await rest(`/redirects/${id}`, "PATCH", "admin", { origin: "auto" });
      expect(forgedUpdate.status).toBe(200);

      const stored = await handle.payload.findByID({
        collection: "redirects",
        id,
        overrideAccess: true,
      });
      expect(stored.origin).toBe("manual");
    });
  },
);
