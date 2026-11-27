import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import type { CollectionConfig, GlobalConfig, Payload } from "payload";
import {
  createRedirectIntPayload,
  draftVersions,
  intDatabaseConfigured,
  localizedDraftVersions,
  type RedirectIntHandle,
} from "../helpers/payload-harness";

const localization = {
  locales: ["en", "fr", "de"],
  defaultLocale: "en",
  // Host fallback is on. The plugin must still never borrow another locale's slug.
  fallback: true,
};

const localePrefixes = { en: "", fr: "/fr", de: "/de" };

const localizedArticles = (): CollectionConfig => ({
  slug: "articles",
  versions: localizedDraftVersions,
  fields: [
    { name: "title", type: "text" },
    { name: "slug", type: "text", localized: true },
  ],
  custom: {
    redirect: {
      paths: { en: "/articles/[slug]", fr: "/articles/[slug]", de: "/artikel/[slug]" },
    },
  },
});

const localizedAbout = (): GlobalConfig => ({
  slug: "about",
  versions: localizedDraftVersions,
  fields: [{ name: "slug", type: "text", localized: true }],
  custom: { redirect: { path: "/[slug]" } },
});

const rows = async (payload: Payload) => {
  const { docs } = await payload.find({
    collection: "redirects",
    overrideAccess: true,
    pagination: false,
    sort: "from",
  });
  return docs.map((doc) => [doc.from, doc.to, doc.origin]);
};

/**
 * Experimental `localizeStatus` (Payload 3.94.1 `experimental.localizeStatus` plus
 * `versions.drafts.localizeStatus`). Publication status is per locale, and redirects follow it.
 */
describe.skipIf(!intDatabaseConfigured)("localized publication status (en, fr, de)", () => {
  let handle: RedirectIntHandle;

  beforeAll(async () => {
    handle = await createRedirectIntPayload({
      localization,
      localePrefixes,
      collections: [localizedArticles()],
      globals: [localizedAbout()],
    });
  }, 120_000);

  afterAll(async () => {
    await handle.destroy();
  });

  beforeEach(async () => {
    await handle.resetArticles();
    await handle.resetRedirects();
  });

  const createArticle = async (data: Record<string, unknown>, locale: "en" | "fr" | "de" = "en") =>
    handle.payload.create({
      collection: "articles",
      data: { title: "Article", ...data },
      locale,
      draft: true,
      overrideAccess: true,
    });

  const publishLocale = (id: string | number, locale: "en" | "fr" | "de") =>
    handle.payload.update({
      collection: "articles",
      id,
      data: { _status: "published" },
      locale,
      publishSpecificLocale: locale,
      overrideAccess: true,
    });

  const draftLocale = (id: string | number, locale: "en" | "fr" | "de", slug: string) =>
    handle.payload.update({
      collection: "articles",
      id,
      data: { slug },
      locale,
      draft: true,
      overrideAccess: true,
    });

  it("publishing one locale creates no rule until that locale changes its published slug", async () => {
    const id = (await createArticle({ slug: "getting-started" }, "fr")).id;
    await publishLocale(id, "fr");
    expect(await rows(handle.payload)).toEqual([]);

    await draftLocale(id, "fr", "premiers-pas");
    await publishLocale(id, "fr");

    expect(await rows(handle.payload)).toEqual([
      ["/fr/articles/getting-started", "/fr/articles/premiers-pas", "auto"],
    ]);
  });

  it("a localized draft that changes a slug without publication creates no rule", async () => {
    const id = (await createArticle({ slug: "getting-started" }, "en")).id;
    await publishLocale(id, "en");
    await draftLocale(id, "en", "introduction-to-payload");

    expect(await rows(handle.payload)).toEqual([]);
  });

  it("one locale's new published slug leaves the other locales' published paths unchanged", async () => {
    const id = (await createArticle({ slug: "getting-started" }, "en")).id;
    await draftLocale(id, "fr", "premiers-pas");
    await draftLocale(id, "de", "erste-schritte");
    await handle.payload.update({
      collection: "articles",
      id,
      data: { _status: "published" },
      publishAllLocales: true,
      overrideAccess: true,
    });
    await draftLocale(id, "fr", "bien-demarrer");
    await publishLocale(id, "fr");

    expect(await rows(handle.payload)).toEqual([
      ["/fr/articles/premiers-pas", "/fr/articles/bien-demarrer", "auto"],
    ]);
  });

  it("a locale without a translated slug is skipped and never borrows the default locale's slug", async () => {
    const id = (await createArticle({ slug: "getting-started" }, "en")).id;
    await publishLocale(id, "en");
    // German has no slug. Host fallback is enabled, but redirect generation disables it.
    await publishLocale(id, "de");
    await draftLocale(id, "en", "introduction-to-payload");
    await publishLocale(id, "en");

    expect(await rows(handle.payload)).toEqual([
      ["/articles/getting-started", "/articles/introduction-to-payload", "auto"],
    ]);
  });

  it("a locale unpublished and then republished with a new slug links from its last published path", async () => {
    const id = (await createArticle({ slug: "premiers-pas" }, "fr")).id;
    await publishLocale(id, "fr");
    await handle.payload.update({
      collection: "articles",
      id,
      data: { _status: "draft" },
      locale: "fr",
      unpublishSpecificLocale: "fr",
      overrideAccess: true,
    } as never);
    await draftLocale(id, "fr", "bien-demarrer");
    await publishLocale(id, "fr");

    expect(await rows(handle.payload)).toEqual([
      ["/fr/articles/premiers-pas", "/fr/articles/bien-demarrer", "auto"],
    ]);
  });

  it("publishing all locales together creates one rule per locale whose path changed", async () => {
    const id = (await createArticle({ slug: "getting-started" }, "en")).id;
    await draftLocale(id, "fr", "premiers-pas");
    await draftLocale(id, "de", "erste-schritte");
    await handle.payload.update({
      collection: "articles",
      id,
      data: { _status: "published" },
      publishAllLocales: true,
      overrideAccess: true,
    });

    await draftLocale(id, "en", "introduction-to-payload");
    await draftLocale(id, "fr", "bien-demarrer");
    await draftLocale(id, "de", "einfuehrung");
    await handle.payload.update({
      collection: "articles",
      id,
      data: { _status: "published" },
      publishAllLocales: true,
      overrideAccess: true,
    });

    expect(await rows(handle.payload)).toEqual([
      ["/articles/getting-started", "/articles/introduction-to-payload", "auto"],
      ["/de/artikel/erste-schritte", "/de/artikel/einfuehrung", "auto"],
      ["/fr/articles/premiers-pas", "/fr/articles/bien-demarrer", "auto"],
    ]);
  });

  it("a Global locale publication links only the locale that changed", async () => {
    await handle.payload.updateGlobal({
      slug: "about",
      data: { slug: "about" },
      locale: "en",
      publishAllLocales: true,
      overrideAccess: true,
    } as never);
    await handle.payload.updateGlobal({
      slug: "about",
      data: { slug: "a-propos" },
      locale: "fr",
      publishAllLocales: true,
      overrideAccess: true,
    } as never);
    await handle.payload.updateGlobal({
      slug: "about",
      data: { slug: "a-propos-nous" },
      locale: "fr",
      draft: true,
      overrideAccess: true,
    } as never);
    await handle.payload.updateGlobal({
      slug: "about",
      data: { _status: "published" },
      locale: "fr",
      publishSpecificLocale: "fr",
      overrideAccess: true,
    } as never);

    expect(await rows(handle.payload)).toEqual([["/fr/a-propos", "/fr/a-propos-nous", "auto"]]);
    expect(
      (
        await handle.payload.findGlobal({
          slug: "about",
          locale: "en",
          draft: true,
          overrideAccess: true,
        })
      ).slug,
    ).toBe("about");
  });
});
