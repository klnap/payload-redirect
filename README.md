# @klnap/payload-redirect

Redirect management for Payload CMS.

Manage redirects directly in Payload and automatically preserve existing URLs when published content paths change.

Define your public URL structure, enable automatic redirects for selected collections, and let your application's routing layer handle redirect responses.

## Overview

The plugin owns its Payload collection, so manual redirects need no collection stub or automatic-generation setup. Automatic generation is optional and compares complete published paths.

## Installation

```sh
bun add @klnap/payload-redirect
```

Requires Node.js `^22.23.5 || ^24.22.3 || >=26.13.1` and Payload `>=3.94.1 <4`.
PostgreSQL is the supported database adapter.

## Manual redirects

Register the plugin with no options:

```ts
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { redirects } from "@klnap/payload-redirect";

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET!,
  db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URI! } }),
  plugins: [redirects()],
});
```

The plugin adds the `redirects` collection. Add, edit, enable, or disable rules in Payload Admin. Manual rules work without automatic redirect configuration.

## Automatic redirects

Automatic generation is enabled for each collection configured in `redirects({ collections })`. Those collections must use Payload drafts so the plugin can compare published snapshots.

```ts
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { redirects } from "@klnap/payload-redirect";

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET!,
  db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URI! } }),
  localization: {
    locales: ["pl", "en", "de"],
    defaultLocale: "pl",
  },
  collections: [
    {
      slug: "articles",
      versions: { drafts: true },
      fields: [
        { name: "title", type: "text", required: true },
        { name: "slug", type: "text", required: true, localized: true },
      ],
    },
    {
      slug: "projects",
      versions: { drafts: true },
      fields: [{ name: "slug", type: "text", required: true, localized: true }],
    },
  ],
  plugins: [
    redirects({
      localePrefixes: {
        pl: "",
        en: "/en",
        de: "/de",
      },
      collections: {
        articles: { path: "/[slug]" },
        projects: {
          paths: {
            pl: "/realizacje/[slug]",
            en: "/work/[slug]",
            de: "/projekte/[slug]",
          },
        },
      },
    }),
  ],
});
```

### Reading the configuration

> When the published path of a document in this collection changes, redirect the previous path to the new one.

- Articles use one path template. `localePrefixes` adds each locale's explicit prefix.
- Projects use a separate public path template for each Payload locale.
- Collections without redirect configuration remain unaffected.

For a Polish project, a slug change creates this rule:

```text
Previous published path: /realizacje/stary-projekt
Current published path:  /realizacje/nowy-projekt
Generated redirect:      /realizacje/stary-projekt → /realizacje/nowy-projekt
```

The plugin tracks the resolved public URL, not a particular slug field. A change to any field used by the path template can create a redirect.

### Collection-level configuration

Use the same options directly on a collection when central configuration is not convenient:

```ts
import type { CollectionConfig } from "payload";
import type { RedirectCollectionOptions } from "@klnap/payload-redirect";

const projectRedirect = {
  paths: {
    pl: "/realizacje/[slug]",
    en: "/work/[slug]",
    de: "/projekte/[slug]",
  },
} satisfies RedirectCollectionOptions<"projects">;

export const Projects: CollectionConfig = {
  slug: "projects",
  versions: { drafts: true },
  custom: {
    redirect: projectRedirect,
  },
  fields: [{ name: "slug", type: "text", required: true, localized: true }],
};
```

Central configuration replaces collection-level configuration for that collection. The plugin does not merge path strategies.

Set `custom.redirect.enabled` to `false` to disable automatic generation for that collection. Manual redirect management remains enabled.

## Published paths

Choose exactly one path strategy for each configured collection.

### Shared templates

Use `path` when every locale has the same route shape:

```ts
articles: {
  path: "/articles/[slug]";
}
```

Templates use top-level field names in brackets. Use multiple fields when the public route depends on multiple values:

```ts
projects: {
  path: "/[category]/[slug]";
}
```

Each value is encoded as one URL path segment. Missing, invalid, or unsafe values prevent that transition from creating a redirect.

### Localized templates

Use `paths` to give each Payload locale a complete template:

```ts
projects: {
  paths: {
    pl: '/realizacje/[slug]',
    en: '/work/[slug]',
    de: '/projekte/[slug]',
  },
}
```

The map must include every locale configured in Payload. The plugin does not use fallback locale values to resolve a published path.

### Locale prefixes

`localePrefixes` maps Payload locale codes to explicit prefixes. An empty string means no prefix. The map must include every Payload locale when provided.

Prefixes apply to `path` and `paths`. If `localePrefixes` is omitted, the plugin adds no prefix and does not infer one from the locale code.

### Custom path resolution

Use `getPath` when templates cannot express the public route:

```ts
projects: {
  getPath: ({ doc, locale }) =>
    doc.slug && doc.category
      ? `${locale ? `/${locale}` : ''}/${String(doc.category)}/${String(doc.slug)}`
      : null,
}
```

Payload generated types infer `doc` from the configured collection. The callback receives the locale-specific published snapshot and locale; locale is `undefined` when Payload localization is off. Return a complete site-relative path or `null`. The plugin does not add `localePrefixes` to callback results.

## Redirect collection

The plugin owns these fields:

- `from`: unique source path.
- `to`: site-relative destination path.
- `statusCode`: `301` or `302`.
- `enabled`: whether the rule is active.
- `origin`: `manual` or `auto`.

The schema uses the camelCase field `statusCode`.

### Collection overrides

Pass native Payload collection options through `overrides`:

```ts
redirects({
  overrides: {
    slug: "url-rules",
    labels: { singular: "URL rule", plural: "URL rules" },
    admin: { group: "Settings" },
    trash: true,
  },
});
```

Use `overrides.fields` to customize the plugin fields. Required fields, validation, uniqueness, and indexes remain enforced.

## Automatic redirect behavior

- Draft saves, autosaves, first publications, unpublishes, and unchanged paths create no rules.
- The plugin compares the current published path with the latest earlier published path.
- A missing or unsafe path on either side skips that locale's redirect.
- A manual rule that owns the previous path is never overwritten.
- Automatic writes run through Payload Local API with the active request and transaction.
- Deleting a document does not create a redirect; configure removal behavior in your application if needed.

Automatic generation requires `versions.drafts`. It reads published versions with fallback disabled so localized paths never borrow values from another locale.

## Application integration

The package stores rules. Your application retrieves enabled rules, caches them, matches incoming paths, and returns HTTP redirect responses.

```ts
const { docs } = await payload.find({
  collection: "redirects",
  where: { enabled: { equals: true } },
  depth: 0,
});

// Match the incoming path and return the selected rule's statusCode and to.
```

The package does not include a resolver, cache, middleware, proxy, or framework adapter.

## Security and reliability

The collection validates site-relative sources, rejects unsafe destinations, prevents duplicate sources, and checks enabled redirect chains for loops. Manual rules are protected from automatic writes.

PostgreSQL provides the transaction-scoped advisory lock used to serialize graph validation. This package does not claim equivalent concurrent-write guarantees for other adapters.

## Requirements

- Payload: `>=3.94.1 <4`.
- PostgreSQL: supported adapter for transaction-scoped graph locking.
- Other adapters: no equivalent concurrency guarantee is claimed.

## License

MIT
