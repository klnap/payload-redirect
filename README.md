# `@klnap/payload-redirect`

Manage manual redirects in Payload and record `301` redirects when configured content paths change after publication.

```ts
import { postgresAdapter } from "@payloadcms/db-postgres";
import { buildConfig } from "payload";
import { redirects } from "@klnap/payload-redirect";

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET!,
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL! },
  }),
  collections: [
    {
      slug: "articles",
      versions: { drafts: true },
      fields: [{ name: "slug", type: "text", required: true }],
    },
  ],
  plugins: [
    redirects({
      collections: {
        articles: { path: "/articles/[slug]" },
      },
    }),
  ],
});
```

## Why?

Payload stores drafts and published versions, while your application defines each collection's public URL. To preserve URLs after a path change, an app must connect its route definition to those published versions. Configure that mapping here; the plugin records the old path, and your application still delivers the redirect.

## Features

- Manage manual redirect rules in Payload Admin without defining the redirects collection yourself.
- Create or update a permanent redirect when a configured published path changes, unless a manual rule owns the old path.
- Resolve shared, localized, or custom paths from published document data.
- Reject duplicate source paths and enabled redirect chains that loop.
- Keep route matching, caching, and HTTP responses in your application.

## Installation

```bash
bun add @klnap/payload-redirect
```

```bash
npm install @klnap/payload-redirect
```

`payload` is a required peer dependency. `@payloadcms/db-postgres` is an optional peer; install it when your Payload app uses PostgreSQL.

## Usage

### Manual redirects

Register the plugin with no options to add its `redirects` collection. Add this property to your existing `buildConfig` call:

```ts
plugins: [redirects()],
```

Create, edit, enable, or disable manual rules in Payload Admin. Manual rules do not require drafts or automatic path configuration.

### Automatic redirects

Enable drafts on each collection whose published paths should be tracked. For localized paths, also configure Payload localization. Configure one path strategy per collection:

```ts
redirects({
  collections: {
    articles: { path: "/articles/[slug]" },
    projects: {
      paths: {
        en: "/work/[slug]",
        pl: "/realizacje/[slug]",
      },
    },
  },
});
```

Use this object in `buildConfig({ plugins: [...] })`. `path` defines one route template; `paths` defines a complete template for every Payload locale. The earlier example shows a full PostgreSQL-backed Payload config.

You can put the same options on a collection under `custom.redirect` when that fits your config organization:

```ts
import type { CollectionConfig } from "payload";

const projects: CollectionConfig = {
  slug: "projects",
  versions: { drafts: true },
  custom: {
    redirect: {
      path: "/projects/[slug]",
    },
  },
  fields: [{ name: "slug", type: "text", required: true, localized: true }],
};
```

Central `collections` entries replace `custom.redirect` for the same collection; the plugin does not merge them. Set `enabled: false` to disable automatic generation for a collection without disabling manual rules.

### Localized and custom paths

With Payload locales `en` and `pl`, use `localePrefixes` when both locales share a route template:

```ts
redirects({
  localePrefixes: { en: "/en", pl: "" },
  collections: {
    articles: { path: "/articles/[slug]" },
  },
});
```

Use `getPath` when a template cannot express the route. It receives the locale-specific published document and locale. Return a complete site-relative path or `null`; the plugin does not add `localePrefixes` to this result.

```ts
redirects({
  collections: {
    projects: {
      getPath: ({ doc, locale }) =>
        doc.category && doc.slug
          ? `${locale ? `/${locale}` : ""}/${encodeURIComponent(String(doc.category))}/${encodeURIComponent(String(doc.slug))}`
          : null,
    },
  },
});
```

### Deliver redirects in your application

The plugin stores rules; it does not add middleware, a resolver, or a framework adapter. It normalizes paths when saving rules, not when querying them. Normalize the incoming path to the same form as `from`; include a query string when your source rules use one.

Query enabled rules and return the selected rule from your own request handler:

```ts
const { docs } = await payload.find({
  collection: "redirects",
  where: {
    and: [
      { from: { equals: pathname } },
      { enabled: { equals: true } },
    ],
  },
  limit: 1,
  depth: 0,
});

const rule = docs[0];
if (rule) {
  return Response.redirect(new URL(rule.to, request.url), Number(rule.statusCode));
}
```

Adapt the handler to your framework and caching strategy.

## Configuration

Pass options to `redirects(options?)`. The public exports are `redirects`, `RedirectsOptions`, `RedirectCollectionOptions<TSlug>`, `RedirectOrigin`, and `RedirectStatusCode`.

| Option           | Default                                 | Behavior                                                                                                                                                   |
| ---------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collections`    | No automatic rules                      | Maps registered collection slugs to path options. Each entry requires exactly one of `path`, `paths`, or `getPath`.                                        |
| `localePrefixes` | No prefix                               | Maps every configured Payload locale to a site-relative prefix. Applies to `path` and `paths`, not `getPath`.                                              |
| `overrides`      | Plugin defaults                         | Passes Payload collection options to the plugin-owned redirects collection. Use `slug` to change its collection slug and `fields` to customize its fields. |
| `enabled`        | `true` when path options are configured | Set to `false` to skip automatic generation for that collection. It cannot be combined with a path strategy.                                               |

Path templates start with `/` and use top-level document fields in brackets, such as `/[category]/[slug]`. Dynamic values must be non-empty strings or finite numbers; the plugin URL-encodes each value. Missing or invalid values skip that locale's redirect.

`paths` and `localePrefixes` must contain exactly the configured Payload locale codes. A localized field does not fall back to another locale when resolving a published path. `getPath` must return a complete site-relative path or `null`; it cannot return an absolute URL, query string, or fragment.

The plugin-owned collection uses these fields:

| Field        | Default and behavior                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------- |
| `from`       | Required, unique source path.                                                                  |
| `to`         | Required site-relative destination path.                                                       |
| `statusCode` | `301` by default; `302` is also supported. Payload stores select values as `"301"` or `"302"`. |
| `enabled`    | `true`; disabled rules are not active.                                                         |
| `origin`     | `manual` for manual creates and edits; automatic rules are marked `auto`.                      |

The collection slug defaults to `redirects`; `trash` defaults to `true`, `versions` to `false`, and timestamps to `true`. If another collection already uses `redirects`, choose a different slug with `overrides.slug`. Reads are public by default. Manual writes require an authenticated non-service user; automatic writes use an internal request context. Use `overrides.access` to apply your application's access policy.

`overrides.fields` receives `{ defaultFields }` and returns fields to merge with the defaults. The plugin preserves built-in validators, then runs any custom validator. Keep the required fields' original types, keep `from` unique, and keep `enabled` indexed.

The exported `RedirectStatusCode` type is `301 | 302`; `RedirectOrigin` is `"manual" | "auto"`.

## Compatibility

- Node.js: `^22.23.5 || ^24.22.3 || >=26.13.1`.
- Payload: `>=3.94.1 <4`.
- Optional `@payloadcms/db-postgres` peer: `>=3.94.1 <4`.
- Automatic redirects require `versions.drafts` on each configured collection.
- PostgreSQL uses a transaction-scoped advisory lock to serialize redirect graph checks. Other adapters do not provide the same concurrent-write guarantee.

The current published package version is `0.3.1`.

## Documentation

- [Failure semantics](./docs/FAILURE_SEMANTICS.md)
- [Payload plugin documentation](https://payloadcms.com/docs/plugins/overview)
- [Payload drafts and versions](https://payloadcms.com/docs/versions/drafts)
- [Payload query language](https://payloadcms.com/docs/queries/overview)

## License

[MIT](./LICENSE)
