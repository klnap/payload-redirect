import { describe, expect, it } from "bun:test";
import {
  buildRedirectFields,
  mergeRedirectFields,
} from "#redirect/core/redirects/collection/fields";

describe("redirect fields", () => {
  const fields = buildRedirectFields();
  const names = fields.map((f) => ("name" in f ? f.name : ""));

  it("includes plugin-owned fields", () => {
    expect(names).toEqual(["from", "to", "statusCode", "enabled", "origin"]);
  });

  it("from is unique (Payload postgres adapter creates a unique btree; separate index: true is redundant)", () => {
    const from = fields.find((f) => "name" in f && f.name === "from");
    expect(from && "unique" in from ? from.unique : undefined).toBe(true);
    expect(from && "index" in from ? from.index : undefined).not.toBe(true);
  });

  it("leaves plugin field access to Payload defaults", () => {
    for (const name of ["from", "to", "statusCode", "enabled", "origin"] as const) {
      const field = fields.find((f) => "name" in f && f.name === name);
      expect(field && "access" in field ? field.access : undefined).toBeUndefined();
    }
  });

  it("enabled is indexed for bulk fetch filters", () => {
    const enabled = fields.find((f) => "name" in f && f.name === "enabled");
    expect(enabled && "index" in enabled ? enabled.index : undefined).toBe(true);
  });

  it("statusCode is a Type select (301/302 stored as strings)", () => {
    const status = fields.find((f) => "name" in f && f.name === "statusCode");
    expect(status && "type" in status ? status.type : undefined).toBe("select");
    expect(status && "label" in status ? status.label : undefined).toBe("Type");
    expect(status && "defaultValue" in status ? status.defaultValue : undefined).toBe("301");
    expect(status && "options" in status ? status.options : undefined).toEqual([
      { label: "Permanent", value: "301" },
      { label: "Temporary", value: "302" },
    ]);
  });

  it("origin options are Manual and Auto only", () => {
    const origin = fields.find((f) => "name" in f && f.name === "origin");
    expect(origin && "options" in origin ? origin.options : undefined).toEqual([
      { label: "Manual", value: "manual" },
      { label: "Auto", value: "auto" },
    ]);
    const validate = (
      origin && "validate" in origin && typeof origin.validate === "function"
        ? origin.validate
        : undefined
    ) as ((value: unknown, ctx: unknown) => string | true) | undefined;
    expect(validate?.("automatic", { siblingData: {} })).toMatch(/manual|auto/);
    expect(validate?.("auto", { siblingData: {} })).toBe(true);
  });

  it("from rejects absolute URLs and host-like paths", () => {
    const from = fields.find((f) => "name" in f && f.name === "from");
    const validate = (
      from && "validate" in from && typeof from.validate === "function" ? from.validate : undefined
    ) as ((value: unknown, ctx: unknown) => string | true) | undefined;
    const ctx = { siblingData: {} };
    expect(validate?.("/ok-path", ctx)).toBe(true);
    expect(validate?.("/oferta.html", ctx)).toBe(true);
    expect(validate?.("/old#section", ctx)).toMatch(/fragment/);
    expect(validate?.("https://example.com/a", ctx)).toMatch(/site-relative/);
    expect(validate?.("//example.com/a", ctx)).toMatch(/site-relative/);
    expect(validate?.("example.com/a", ctx)).toMatch(/site-relative/);
    expect(validate?.(null, ctx)).toBe("from is required");
    expect(validate?.("   ", ctx)).toBe("from is required");
    expect(validate?.("http://[invalid", ctx)).toMatch(/site-relative/i);
  });

  it("to validates destination, status, and relative paths", () => {
    const to = fields.find((f) => "name" in f && f.name === "to");
    const validate = (
      to && "validate" in to && typeof to.validate === "function" ? to.validate : undefined
    ) as
      | ((value: unknown, ctx: { siblingData: Record<string, unknown> }) => string | true)
      | undefined;
    expect(validate?.("/target", { siblingData: { statusCode: "301" } })).toBe(true);
    expect(validate?.("/oferta.html", { siblingData: { statusCode: "301" } })).toBe(true);
    expect(validate?.("https://example.com", { siblingData: { statusCode: "301" } })).toMatch(
      /site-relative/,
    );
    expect(validate?.("", { siblingData: { statusCode: "301" } })).toMatch(/non-empty/i);
    expect(validate?.("/target", { siblingData: { statusCode: "307" } })).toMatch(/status/i);
    expect(validate?.("http://[invalid", { siblingData: { statusCode: "301" } })).toMatch(
      /site-relative/i,
    );
    expect(validate?.("/same", { siblingData: { statusCode: "301", from: "/same/" } })).toMatch(
      /differ/,
    );
    expect(validate?.("/target", { siblingData: { statusCode: "301", from: "/same" } })).toBe(true);
  });
});

describe("mergeRedirectFields", () => {
  it("places plugin fields first, then host-only fields", () => {
    const merged = mergeRedirectFields([
      { name: "description", type: "richText" },
      { name: "from", type: "text", unique: true, index: true },
    ]);

    expect(merged.map((f) => ("name" in f ? f.name : ""))).toEqual([
      "from",
      "to",
      "statusCode",
      "enabled",
      "origin",
      "description",
    ]);
  });

  it("uses host override at the plugin field position", () => {
    const merged = mergeRedirectFields([
      {
        name: "statusCode",
        type: "select",
        options: [
          { label: "Permanent", value: "301" },
          { label: "Temporary", value: "302" },
        ],
        admin: { position: "sidebar", description: "custom" },
      },
    ]);

    const status = merged.find((f) => "name" in f && f.name === "statusCode");
    expect(
      status && "admin" in status
        ? (status.admin as { description?: string })?.description
        : undefined,
    ).toBe("custom");
    const last = merged.at(-1);
    expect(last && "name" in last ? last.name : undefined).toBe("origin");
  });

  it("keeps redirect validation when hosts override plugin fields", async () => {
    const merged = mergeRedirectFields([
      { name: "from", type: "text", unique: true },
      { name: "to", type: "text" },
      { name: "statusCode", type: "select", options: ["301", "302", "307"] },
    ]);
    const validate = (name: string) => {
      const field = merged.find((item) => "name" in item && item.name === name);
      return field && "validate" in field && typeof field.validate === "function"
        ? (field.validate as (
            value: unknown,
            options: never,
          ) => Promise<string | true> | string | true)
        : undefined;
    };

    expect(await validate("from")?.("https://example.com", { siblingData: {} } as never)).toMatch(
      /site-relative/,
    );
    expect(
      await validate("to")?.("javascript:alert(1)", {
        siblingData: { statusCode: "301" },
      } as never),
    ).toMatch(/site-relative/);
    expect(await validate("statusCode")?.("307", { siblingData: {} } as never)).toMatch(
      /statusCode/,
    );
  });

  it("keeps unnamed host fields after plugin fields", () => {
    const unnamed = { type: "ui", name: undefined } as never;
    const merged = mergeRedirectFields([unnamed]);
    expect(merged.at(-1)).toBe(unnamed);
  });
});
