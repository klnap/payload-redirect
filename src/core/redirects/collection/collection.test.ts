import { describe, expect, it } from "bun:test";
import { createRedirectsCollection } from "#redirect/core/redirects/collection/collection";

describe("redirects collection", () => {
  it("defaults sort to from for stable pagination", () => {
    const collection = createRedirectsCollection({});
    expect(collection.defaultSort).toBe("from");
  });

  it("disables versions by default", () => {
    const collection = createRedirectsCollection({});
    expect(collection.versions).toBe(false);
  });

  it("uses from as title and default columns", () => {
    const collection = createRedirectsCollection({});
    expect(collection.slug).toBe("redirects");
    expect(collection.admin?.useAsTitle).toBe("from");
    expect(collection.admin?.defaultColumns).toEqual([
      "from",
      "to",
      "statusCode",
      "origin",
      "enabled",
      "updatedAt",
    ]);
    expect(collection.trash).toBe(true);
  });

  it("allows disabling trash via options", () => {
    const collection = createRedirectsCollection({
      trash: false,
    });
    expect(collection.trash).toBe(false);
  });

  it("leaves native Payload access defaults unspecified", () => {
    expect(createRedirectsCollection({}).access).toBeUndefined();
  });

  it("passes native access overrides through unchanged", () => {
    const denyAll = () => false;
    const collection = createRedirectsCollection({
      access: { read: denyAll, create: denyAll },
    });
    expect(collection.access?.read).toBe(denyAll);
    expect(collection.access?.create).toBe(denyAll);
    expect(collection.access?.update).toBeUndefined();
  });
});
