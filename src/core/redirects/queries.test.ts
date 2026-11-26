import { describe, expect, it } from "bun:test";
import type { Payload } from "payload";
import { findRedirectByFrom } from "#redirect/core/redirects/queries";

describe("findRedirectByFrom", () => {
  it("excludes a numeric zero document ID when checking for duplicates", async () => {
    let query: Record<string, unknown> | undefined;
    const payload = {
      find: async (args: Record<string, unknown>) => {
        query = args;
        return { docs: [], totalDocs: 0 };
      },
    } as unknown as Payload;

    await findRedirectByFrom(payload, {
      collectionSlug: "redirects",
      from: "/old",
      excludeId: 0,
    });

    expect(query?.where).toEqual({
      and: [{ from: { equals: "/old" } }, { id: { not_equals: 0 } }],
    });
  });
});
