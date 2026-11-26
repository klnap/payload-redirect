import { describe, expect, it, mock } from "bun:test";
import type { Config } from "payload";
import { redirects } from "#redirect/plugin/payload-plugin";

const config = (input: Partial<Config> = {}) =>
  redirects()({
    collections: [],
    ...input,
  } as unknown as Config as Config) as Config;

describe("redirects plugin config transform", () => {
  it("registers the owned collection with no automatic-generation setup", () => {
    const result = config({ collections: [{ slug: "articles", fields: [] }] });
    expect(result.collections?.map(({ slug }) => slug)).toEqual(["articles", "redirects"]);
    expect(result.collections?.[0]?.hooks?.afterChange).toBeUndefined();
  });

  it("wires collection-local configuration and preserves host hooks", () => {
    const existingHook = () => undefined;
    const result = config({
      collections: [
        {
          slug: "projects",
          versions: { drafts: true },
          fields: [],
          hooks: { afterChange: [existingHook] },
          custom: { redirect: { paths: { en: "/projects/[slug]" } } },
        },
      ],
      localization: { locales: ["en"], defaultLocale: "en" },
    });
    const project = result.collections?.[0];
    expect(project?.hooks?.afterChange).toHaveLength(2);
    expect(project?.hooks?.afterChange?.[0]).toBe(existingHook);
  });

  it("gives centralized configuration complete precedence over collection-local settings", async () => {
    const findByID = mock(async () => ({ id: "p1", slug: "new", _status: "published" }));
    const findVersions = mock(async () => ({
      docs: [
        { version: { slug: "new", _status: "published" } },
        { version: { slug: "old", _status: "published" } },
      ],
      hasNextPage: false,
    }));
    const find = mock(async () => ({ docs: [] }));
    const create = mock(async () => ({}));
    const result = redirects({
      collections: { articles: { path: "/central/[slug]" } },
    })({
      collections: [
        {
          slug: "articles",
          versions: { drafts: true },
          fields: [],
          custom: { redirect: { paths: { en: "/local/[slug]" } } },
        },
      ],
      localization: { locales: ["en"], defaultLocale: "en" },
    } as unknown as Config) as Config;
    const hook = result.collections?.[0]?.hooks?.afterChange?.[0];
    await hook?.({
      req: {
        locale: "en",
        query: { locale: "en" },
        context: {},
        payload: { config: result, findByID, findVersions, find, create },
      },
      collection: result.collections?.[0],
      doc: { id: "p1", slug: "new", _status: "published" },
      data: { _status: "published" },
    } as never);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          from: "/central/old",
          to: "/central/new",
          statusCode: "301",
          enabled: true,
          origin: "auto",
        },
      }),
    );
  });

  it("keeps disabled automatic generation separate from manual collection registration", () => {
    const result = config({
      collections: [
        {
          slug: "articles",
          versions: { drafts: true },
          fields: [],
          custom: { redirect: { enabled: false } },
        },
      ],
    });
    expect(result.collections?.[0]?.hooks?.afterChange).toBeUndefined();
    expect(result.collections?.some(({ slug }) => slug === "redirects")).toBe(true);
  });

  it("lets a central disabled entry replace local automatic configuration", () => {
    const result = redirects({
      collections: { articles: { enabled: false } },
    })({
      collections: [
        {
          slug: "articles",
          versions: { drafts: true },
          fields: [],
          custom: { redirect: { path: "/[slug]" } },
        },
      ],
    } as unknown as Config) as Config;

    expect(result.collections?.[0]?.hooks?.afterChange).toBeUndefined();
  });

  it("supports native collection overrides and rejects slug collisions", () => {
    const result = redirects({
      overrides: { slug: "url-rules", labels: { singular: "URL rule", plural: "URL rules" } },
    })({ collections: [] } as unknown as Config) as Config;
    expect(result.collections?.[0]?.slug).toBe("url-rules");

    expect(() =>
      redirects()({ collections: [{ slug: "redirects", fields: [] }] } as unknown as Config),
    ).toThrow(/already registered/);
  });

  it("validates configured collections, locale maps, path strategies, and versioning", () => {
    expect(() =>
      redirects({ collections: { missing: { path: "/[slug]" } } })({
        collections: [],
      } as unknown as Config),
    ).toThrow(/not registered/);

    expect(() =>
      redirects({
        localePrefixes: { en: "", pl: "/pl" },
        collections: { articles: { paths: { en: "/[slug]" } } },
      })({
        localization: { locales: ["en", "pl"], defaultLocale: "en" },
        collections: [{ slug: "articles", versions: { drafts: true }, fields: [] }],
      } as unknown as Config),
    ).toThrow(/missing: pl/);

    expect(() =>
      redirects({ collections: { articles: { path: "/[slug]" } } })({
        collections: [{ slug: "articles", fields: [] }],
      } as unknown as Config),
    ).toThrow(/require versions\.drafts/);
  });

  it("rejects incompatible collection options at startup", () => {
    expect(() =>
      redirects({
        collections: {
          articles: { path: "/[slug]", paths: { en: "/[slug]" } } as never,
        },
      })({
        localization: { locales: ["en"], defaultLocale: "en" },
        collections: [{ slug: "articles", versions: { drafts: true }, fields: [] }],
      } as unknown as Config),
    ).toThrow(/exactly one/);
  });

  it("rejects duplicate installation", () => {
    const plugin = redirects();
    expect(() =>
      plugin({ collections: [], plugins: [plugin, redirects()] } as unknown as Config),
    ).toThrow(/only once/);
  });
});
