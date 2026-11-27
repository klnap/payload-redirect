// Mirrors the TypeScript examples in README.md. Checked against dist types by tsconfig.type-fixture.json.
import {
  type RedirectCollectionOptions,
  type RedirectGlobalOptions,
  redirects,
} from "@klnap/payload-redirect";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig, type CollectionConfig, type GlobalConfig } from "payload";

declare module "payload" {
  interface GeneratedTypes {
    collections: {
      articles: { id: string; title: string; slug: string; category: string };
      redirects: {
        id: string;
        from: string;
        to: string;
        statusCode: "301" | "302";
        enabled: boolean;
        origin: "manual" | "auto";
      };
    };
    globals: {
      about: { slug: string };
    };
    locale: "en" | "fr" | "de";
  }
}

// Quick start.
export const quickStart = buildConfig({
  secret: "readme-secret",
  editor: lexicalEditor(),
  db: postgresAdapter({ pool: { connectionString: "postgres://localhost/readme" } }),
  plugins: [
    redirects({
      collections: {
        articles: { path: "/articles/[slug]" },
      },
    }),
  ],
});

// Automatic redirects: Collection.
export const Articles: CollectionConfig = {
  slug: "articles",
  versions: { drafts: true },
  admin: { useAsTitle: "title" },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", required: true },
  ],
  custom: {
    redirect: {
      path: "/articles/[slug]",
    } satisfies RedirectCollectionOptions<"articles">,
  },
};

export const ArticlesWithGetPath: CollectionConfig = {
  slug: "articles",
  versions: { drafts: true },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", required: true },
    { name: "category", type: "text", required: true },
  ],
  custom: {
    redirect: {
      getPath: ({ doc }) => (doc.category === "interviews" ? `/interviews/${doc.slug}` : null),
    } satisfies RedirectCollectionOptions<"articles">,
  },
};

// Automatic redirects: Global.
export const About: GlobalConfig = {
  slug: "about",
  versions: { drafts: true },
  fields: [{ name: "slug", type: "text", required: true }],
  custom: {
    redirect: {
      path: "/[slug]",
    } satisfies RedirectGlobalOptions<"about">,
  },
};

// Localization.
export const localized = buildConfig({
  secret: "readme-secret",
  editor: lexicalEditor(),
  db: postgresAdapter({ pool: { connectionString: "postgres://localhost/readme" } }),
  localization: {
    locales: ["en", "fr", "de"],
    defaultLocale: "en",
  },
  collections: [
    {
      slug: "articles",
      versions: { drafts: true },
      fields: [
        { name: "title", type: "text", required: true, localized: true },
        { name: "slug", type: "text", required: true, localized: true },
      ],
      custom: {
        redirect: {
          paths: {
            en: "/articles/[slug]",
            fr: "/articles/[slug]",
            de: "/artikel/[slug]",
          },
        } satisfies RedirectCollectionOptions<"articles">,
      },
    },
  ],
  plugins: [
    redirects({
      localePrefixes: { en: "", fr: "/fr", de: "/de" },
    }),
  ],
});

// Options and access.
export const withOverrides = buildConfig({
  secret: "readme-secret",
  editor: lexicalEditor(),
  db: postgresAdapter({ pool: { connectionString: "postgres://localhost/readme" } }),
  plugins: [
    redirects({
      overrides: {
        slug: "url-redirects",
        admin: { group: "Settings" },
        fields: ({ defaultFields }) => [...defaultFields, { name: "editorNote", type: "textarea" }],
      },
    }),
  ],
});

export const publicRead = buildConfig({
  secret: "readme-secret",
  editor: lexicalEditor(),
  db: postgresAdapter({ pool: { connectionString: "postgres://localhost/readme" } }),
  plugins: [
    redirects({
      overrides: {
        access: {
          read: () => true,
        },
      },
    }),
  ],
});

export const central = redirects({
  collections: {
    articles: { path: "/articles/[slug]" },
  },
  globals: {
    about: { path: "/[slug]" },
  },
  localePrefixes: { en: "", fr: "/fr", de: "/de" },
});
