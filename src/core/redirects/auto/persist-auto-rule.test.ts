import { describe, expect, test } from "bun:test";
import type { PayloadRequest } from "payload";
import { ensureAutoRedirect } from "#redirect/core/redirects/auto/persist-auto-rule";

const makeReq = (payload: Record<string, unknown>): PayloadRequest =>
  ({ payload }) as unknown as PayloadRequest;

const autoDoc = {
  id: "1",
  from: "/a",
  to: "/b",
  statusCode: 301,
  enabled: true,
  origin: "auto",
};

describe("ensureAutoRedirect", () => {
  test("skips when identical auto rule already exists", async () => {
    const payload = {
      find: async (args: { overrideAccess?: boolean }) => {
        expect(args.overrideAccess).toBe(true);
        return { docs: [autoDoc], totalDocs: 1 };
      },
      create: async () => {
        throw new Error("should not create");
      },
      update: async () => {
        throw new Error("should not update");
      },
    };
    const result = await ensureAutoRedirect({
      req: makeReq(payload),
      collectionSlug: "redirects",
      rule: { from: "/a", to: "/b" },
    });
    expect(result).toBe("skipped");
  });

  test("skips when from is occupied by another rule", async () => {
    const payload = {
      find: async (args: { overrideAccess?: boolean }) => {
        expect(args.overrideAccess).toBe(true);
        return {
          docs: [{ ...autoDoc, id: "9", to: "/z", origin: "manual" }],
          totalDocs: 1,
        };
      },
      create: async () => {
        throw new Error("should not create");
      },
      update: async () => {
        throw new Error("should not update");
      },
    };
    const result = await ensureAutoRedirect({
      req: makeReq(payload),
      collectionSlug: "redirects",
      rule: { from: "/a", to: "/b" },
    });
    expect(result).toBe("skipped");
  });

  test("updates auto rule when target path changes", async () => {
    let updated = false;
    const payload = {
      find: async (args: { overrideAccess?: boolean }) => {
        expect(args.overrideAccess).toBe(true);
        return { docs: [{ ...autoDoc, to: "/old-target" }], totalDocs: 1 };
      },
      update: async (args: { overrideAccess?: boolean }) => {
        expect(args.overrideAccess).toBe(true);
        updated = true;
      },
      create: async () => {
        throw new Error("should not create");
      },
    };
    const result = await ensureAutoRedirect({
      req: makeReq(payload),
      collectionSlug: "redirects",
      rule: { from: "/a", to: "/new-target" },
    });
    expect(result).toBe("updated");
    expect(updated).toBe(true);
  });

  test("creates when no conflict", async () => {
    let created = false;
    const payload = {
      find: async (args: { overrideAccess?: boolean }) => {
        expect(args.overrideAccess).toBe(true);
        return { docs: [], totalDocs: 0 };
      },
      create: async (args: { data: { origin: string }; overrideAccess?: boolean }) => {
        created = true;
        expect(args.data.origin).toBe("auto");
        expect(args.overrideAccess).toBe(true);
      },
      update: async () => {
        throw new Error("should not update");
      },
    };
    const result = await ensureAutoRedirect({
      req: makeReq(payload),
      collectionSlug: "redirects",
      rule: { from: "/x", to: "/y" },
    });
    expect(result).toBe("created");
    expect(created).toBe(true);
  });
});
