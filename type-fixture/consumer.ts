import {
  type RedirectCollectionOptions,
  type RedirectOrigin,
  type RedirectStatusCode,
  type RedirectsOptions,
  redirects,
} from "@klnap/payload-redirect";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { buildConfig, type CollectionConfig, type Payload } from "payload";

declare module "payload" {
  interface GeneratedTypes {
    collections: {
      articles: {
        id: string;
        slug: string;
        title: string;
        category: string;
      };
      redirects: {
        id: string;
        from: string;
        to: string;
        statusCode: "301" | "302";
        enabled: boolean;
        origin: "manual" | "auto";
      };
    };
    locale: "de" | "en" | "pl";
  }
}

const articlePath = {
  path: "/articles/[slug]",
} satisfies RedirectCollectionOptions<"articles">;

const articles: CollectionConfig = {
  slug: "articles",
  fields: [],
  custom: { redirect: articlePath },
};

const manualOnlyConfig = buildConfig({
  secret: "fixture-secret",
  db: postgresAdapter({ pool: { connectionString: "postgres://localhost/fixture" } }),
  plugins: [redirects()],
});

const localizedCentralConfig = buildConfig({
  secret: "fixture-secret",
  db: postgresAdapter({ pool: { connectionString: "postgres://localhost/fixture" } }),
  localization: {
    locales: ["en", "pl", "de"],
    defaultLocale: "en",
  },
  collections: [
    {
      slug: "articles",
      versions: { drafts: true },
      fields: [
        { name: "title", type: "text", required: true, localized: true },
        { name: "slug", type: "text", required: true, localized: true },
        { name: "category", type: "text", required: true },
      ],
    },
  ],
  plugins: [
    redirects({
      localePrefixes: { en: "", pl: "/pl", de: "/de" },
      collections: {
        articles: {
          paths: {
            en: "/articles/[slug]",
            pl: "/artykuly/[slug]",
            de: "/artikel/[slug]",
          },
        },
      },
    }),
  ],
});

const articleRedirect = {
  paths: {
    en: "/articles/[slug]",
    pl: "/artykuly/[slug]",
    de: "/artikel/[slug]",
  },
} satisfies RedirectCollectionOptions<"articles">;

const localizedArticles: CollectionConfig = {
  slug: "articles",
  versions: { drafts: true },
  custom: { redirect: articleRedirect },
  fields: [
    { name: "title", type: "text", required: true, localized: true },
    { name: "slug", type: "text", required: true, localized: true },
    { name: "category", type: "text", required: true },
  ],
};

const localizedCollectionConfig = buildConfig({
  secret: "fixture-secret",
  db: postgresAdapter({ pool: { connectionString: "postgres://localhost/fixture" } }),
  localization: {
    locales: ["en", "pl", "de"],
    defaultLocale: "en",
  },
  collections: [localizedArticles],
  plugins: [redirects({ localePrefixes: { en: "", pl: "/pl", de: "/de" } })],
});

const customPathOptions = {
  collections: {
    articles: {
      getPath: ({ doc, locale }) => {
        if (!doc.category || !doc.slug) return null;
        const prefix = locale === "pl" ? "/pl" : locale === "de" ? "/de" : "";
        const category = encodeURIComponent(doc.category);
        const slug = encodeURIComponent(doc.slug);
        return doc.category === "interviews"
          ? `${prefix}/interviews/${slug}`
          : `${prefix}/articles/${category}/${slug}`;
      },
    },
  },
} satisfies RedirectsOptions;

const collectionOverrides = redirects({
  overrides: {
    slug: "url-rules",
    labels: { singular: "URL rule", plural: "URL rules" },
    admin: { group: "Settings" },
    trash: true,
  },
});

declare const payload: Payload;
const enabledRules = payload.find({
  collection: "redirects",
  where: { enabled: { equals: true } },
  depth: 0,
});

const redirectResponse = async (
  request: Request,
  payload: Payload,
  normalizedFrom: string,
): Promise<Response | undefined> => {
  const { docs } = await payload.find({
    collection: "redirects",
    where: {
      and: [{ from: { equals: normalizedFrom } }, { enabled: { equals: true } }],
    },
    limit: 1,
    pagination: false,
    depth: 0,
    overrideAccess: false,
  });
  const rule = docs[0];
  if (!rule) return undefined;
  return Response.redirect(new URL(rule.to, request.url), Number(rule.statusCode));
};

const invalidLocalePath: RedirectsOptions = {
  collections: {
    articles: {
      // @ts-expect-error Locale path maps must include every generated locale.
      paths: {
        en: "/articles/[slug]",
        pl: "/pl/articles/[slug]",
      },
    },
  },
};

const invalidUnknownLocalePath: RedirectsOptions = {
  collections: {
    articles: {
      paths: {
        de: "/de/articles/[slug]",
        en: "/articles/[slug]",
        pl: "/pl/articles/[slug]",
        // @ts-expect-error Locale path maps reject unknown Payload locales.
        fr: "/fr/articles/[slug]",
      },
    },
  },
};

const invalidPrefix: RedirectsOptions = {
  // @ts-expect-error Prefix maps must use generated locale codes.
  localePrefixes: { en: "", pl: "/pl", de: "/de", fr: "/fr" },
};

// @ts-expect-error Only one path strategy is allowed.
const invalidStrategy: RedirectCollectionOptions<"articles"> = {
  path: "/articles/[slug]",
  paths: {
    de: "/de/articles/[slug]",
    en: "/articles/[slug]",
    pl: "/pl/articles/[slug]",
  },
};

const invalidCollection: RedirectsOptions = {
  collections: {
    // @ts-expect-error Collection names must match generated Payload types.
    misspelledArticles: { path: "/[slug]" },
  },
};

const origin: RedirectOrigin = "auto";
const statusCode: RedirectStatusCode = 301;
void articles;
void manualOnlyConfig;
void localizedCentralConfig;
void localizedArticles;
void localizedCollectionConfig;
void customPathOptions;
void collectionOverrides;
void enabledRules;
void redirectResponse;
void invalidLocalePath;
void invalidUnknownLocalePath;
void invalidPrefix;
void invalidStrategy;
void invalidCollection;
void origin;
void statusCode;
