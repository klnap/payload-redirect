# `@klnap/payload-redirect`

Redirect management for Payload CMS.

Automatically preserve existing URLs when published content paths change, including localized routes. Manage manual redirects alongside generated rules while keeping request handling in your application.

Inside an existing Payload config, with `articles` registered and using drafts:

```ts
import { redirects } from "@klnap/payload-redirect";

plugins: [
  redirects({
    collections: {
      articles: {
        path: "/articles/[slug]",
      },
    },
  }),
],
```

If a published slug changes, the plugin creates:

```text
Previous published path: /articles/old-title
Current published path:  /articles/new-title

Generated redirect:
301 /articles/old-title → /articles/new-title
```

## Why?

Published URL changes can break inbound links, bookmarks, and search results. Creating a redirect for every change by hand is repetitive and easy to miss.

The plugin compares resolved paths from Payload's published versions. Because a route can use several document fields, changing a category can create a redirect even when the slug stays the same.

## Features

- Generate permanent redirects when a published path changes.
- Track complete paths built from multiple document fields.
- Use Payload content localization, translated route templates, and explicit locale prefixes.
- Manage manual `301` and `302` redirects alongside generated rules.
- Resolve conditional routes with typed `getPath` callbacks.
- Preserve manual rules when automatic generation reaches their source path.
- Reject duplicate source paths and enabled redirect loops.
- Customize the plugin-owned collection with Payload options and extra fields.
- Keep request matching, responses, and caching in the host application.

## Installation

```bash
bun add @klnap/payload-redirect
```

```bash
npm install @klnap/payload-redirect
```

`payload` is a required peer dependency. `@payloadcms/db-postgres` is an optional peer; install it when using PostgreSQL.

## Usage

### Automatic redirects

Register `redirects()` once in your Payload `plugins` array. Register each tracked collection in Payload and enable `versions.drafts`.

Declare route rules centrally in `redirects({ collections })` or colocate them with a collection under `custom.redirect`. The collection-level pattern keeps public routing beside its schema, which can simplify larger projects.

The plugin compares complete resolved paths from published versions. First publication has no previous path. Draft saves do not create redirects. Unpublishing or deleting a document creates no new rule; existing rules remain.

| Operation                            | Result                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| First publication                    | No previous path exists.                                                                                                                         |
| Saving drafts                        | No automatic redirect.                                                                                                                           |
| Publish a changed path               | Create or update a permanent `301` rule.                                                                                                         |
| Republish an unchanged path          | Keep an identical enabled automatic rule. Recreate a missing rule or re-enable a disabled automatic rule when an earlier published path differs. |
| Unpublish or delete content          | Create no new rule; existing rules remain.                                                                                                       |
| A manual rule owns the previous path | Skip the automatic write and preserve the manual rule.                                                                                           |

Loop validation can reject a publication. For example, publishing `/a` after `/a` already redirects to `/b` would add `/b` → `/a`. Remove or change the conflicting rule before retrying.

Manually editing an automatic rule changes its origin to `manual`; later publication changes no longer update it. Changing `path`, `paths`, or `getPath` does not migrate historical URLs.

### Full-path tracking

Templates can combine top-level fields:

```ts
redirects({
  collections: {
    products: {
      path: "/shop/[category]/[slug]",
    },
  },
});
```

Changing a stored `category` from `chairs` to `office-chairs` creates `/shop/chairs/model-a` → `/shop/office-chairs/model-a`, even if `slug` remains `model-a`.

Use direct document fields for route segments. A template can combine a shared, non-localized `category` with a localized `slug`, such as `/shop/[category]/[slug]`. A relationship placeholder does not follow a referenced document's fields, and changing a related document does not trigger this collection's publication hook.

Placeholders accept non-empty strings and finite numbers. The plugin URL-encodes each value as one segment. Missing or unsafe values skip that locale's redirect.

### Localization

The plugin uses Payload's existing content localization. Add these properties to your existing `buildConfig`; keep its other collections, database, and required config.

```ts
import type { RedirectCollectionOptions } from "@klnap/payload-redirect";
import type { CollectionConfig } from "payload";

const projectRedirect = {
  paths: {
    en: "/work/[slug]",
    pl: "/realizacje/[slug]",
    de: "/projekte/[slug]",
  },
} satisfies RedirectCollectionOptions<"projects">;

const Projects: CollectionConfig = {
  slug: "projects",
  versions: { drafts: true },
  fields: [
    { name: "title", type: "text", localized: true },
    { name: "slug", type: "text", required: true, localized: true },
    { name: "category", type: "text", required: true },
  ],
  custom: { redirect: projectRedirect },
};

localization: {
  locales: ["en", "pl", "de"],
  defaultLocale: "en",
  fallback: true,
},
collections: [Projects],
plugins: [redirects({ localePrefixes: { en: "", pl: "/pl", de: "/de" } })],
```

The resolved paths are:

| Locale | URL                              |
| ------ | -------------------------------- |
| `en`   | `/work/interior-design`          |
| `pl`   | `/pl/realizacje/projekt-wnetrza` |
| `de`   | `/de/projekte/innenarchitektur`  |

Publishing the changed Polish slug `aranzacja-wnetrza` generates:

```text
301 /pl/realizacje/projekt-wnetrza
 →  /pl/realizacje/aranzacja-wnetrza
```

`path` applies one route template to every locale. `paths` maps locale codes to separate templates. `localePrefixes` applies an explicit prefix to either template strategy; use `""` for an unprefixed locale. The plugin never infers prefixes. It does not apply `localePrefixes` to `getPath`.

Locale codes come from `localization.locales`, whether configured as strings or locale objects. `paths` and `localePrefixes` must each contain exactly those codes. `paths` requires Payload localization. Omit `localePrefixes` when localization is disabled; with no locale, a configured prefix map cannot resolve a path.

The plugin reads current and historical published documents with Payload fallback disabled. A missing localized placeholder therefore skips that locale instead of borrowing another locale's value. `filterAvailableLocales` only filters the Admin locale selector; it does not change the locale maps required by this plugin.

Content localization translates document data. Payload `i18n` translates the Admin interface. The plugin's default field labels and validation messages are English; Payload `i18n` does not translate those package strings.

Redirect rules are not locale- or domain-scoped. The stored `from` path is globally unique, so identical source paths cannot redirect differently by locale or hostname. Use distinct route prefixes when locales need distinct sources.

If every locale uses the same route structure, use `path` instead of `paths`:

```ts
const sharedProjectPath = {
  path: "/projects/[slug]",
} satisfies RedirectCollectionOptions<"projects">;
```

### Custom path resolution

Use `getPath` for conditional routes that templates cannot express. Payload-generated types infer `doc` from the collection slug; this example uses the `category` and `slug` fields shown above.

```ts
redirects({
  collections: {
    projects: {
      getPath: ({ doc, locale }) => {
        if (!doc.category || !doc.slug) return null;

        const prefix = locale ? `/${encodeURIComponent(locale)}` : "";
        const slug = encodeURIComponent(doc.slug);

        return doc.category === "journal"
          ? `${prefix}/journal/${slug}`
          : `${prefix}/projects/${slug}`;
      },
    },
  },
});
```

The callback is synchronous, receives a locale-specific published document and `TypedLocale | undefined`, and returns a complete site-relative path or `null`. Encode dynamic segments in the callback. Invalid results skip that locale; the plugin adds no locale prefix.

### Manual redirects

`redirects()` also registers the plugin-owned collection for manual rules. Create, edit, enable, or disable rules in Payload Admin. Choose `301` for permanent redirects and `302` for temporary redirects.

The collection slug defaults to `redirects`. Set `overrides.slug` if that slug is already used. Manual rules need no draft configuration or automatic path options.

### Collection-level configuration

The localized `Projects` collection above colocates route templates under `custom.redirect`. This pattern also accepts `path`, `getPath`, and `{ enabled: false }`.

Central `collections` configuration takes precedence and replaces `custom.redirect`; the two are not merged. Set `{ enabled: false }` centrally or on the collection to disable automatic generation while retaining manual redirects.

Payload Globals are not supported. The plugin reads `custom.redirect` from collections and adds publication hooks only to collections; it does not configure Globals. No Global example is shown because the package has no Global integration API.

### Collection overrides

Pass native collection options, choose a slug and Admin group, or add fields:

```ts
redirects({
  overrides: {
    slug: "url-redirects",
    admin: { group: "Settings" },
    fields: ({ defaultFields }) => [...defaultFields, { name: "notes", type: "textarea" }],
  },
});
```

The plugin keeps its required fields and types, built-in validators, `from` uniqueness, and `enabled` index. It appends its hooks and merges access overrides with defaults. Custom create/update access must still allow internal automatic writes.

### Application integration

The plugin stores rules. It does not match requests, send HTTP responses, or manage caches. This typed lookup accepts a source path that your application has already canonicalized:

```ts
import type { Payload } from "payload";

async function findRedirect(payload: Payload, canonicalFrom: string) {
  const { docs } = await payload.find({
    collection: "redirects",
    where: {
      and: [{ from: { equals: canonicalFrom } }, { enabled: { equals: true } }],
    },
    limit: 1,
    pagination: false,
    depth: 0,
    overrideAccess: false,
  });

  return docs[0];
}
```

Replace `"redirects"` if you set `overrides.slug`. Payload Local API defaults to `overrideAccess: true`; setting it to `false` enforces collection read access. Reads are public by default unless you override them.

The application owns request matching, source canonicalization, query-string policy, HTTP responses, and cache invalidation. Rule writes normalize stored paths; lookup values are not normalized by the plugin. Matching is exact and case-sensitive.

| Input path       | Stored path     | Write-time normalization                                            |
| ---------------- | --------------- | ------------------------------------------------------------------- |
| `/articles/old/` | `/articles/old` | Remove trailing slash except at `/`.                                |
| `/articles//old` | `/articles/old` | Collapse repeated slashes.                                          |
| `/a/../b`        | `/b`            | Resolve dot segments.                                               |
| `/café`          | `/café`         | Preserve Unicode and general escapes; resolve encoded dot segments. |
| `/old?x=1`       | `/old?x=1`      | Preserve query string; match it exactly.                            |

For example, `new URL(request.url).pathname` preserves repeated and trailing slashes, percent-encodes Unicode, and excludes the query. `/café` and `/caf%C3%A9` remain distinct. Loop checks compare normalized stored rules, not every URL a browser may treat as equivalent.

## Configuration

### Integration patterns

| Pattern      | Where to configure it                 | Behavior                                                                               |
| ------------ | ------------------------------------- | -------------------------------------------------------------------------------------- |
| Central      | `redirects({ collections: { ... } })` | One plugin option for registered collection slugs; takes precedence over local config. |
| Entity-level | `CollectionConfig.custom.redirect`    | Colocates the route with its collection and applies when no central entry exists.      |
| Global       | —                                     | Not supported; global hooks and `custom.redirect` are not read by the plugin.          |

### Plugin options

| Option           | Default                             | Behavior                                                                                     |
| ---------------- | ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `collections`    | None                                | Centrally opts registered collections into automatic redirects; overrides `custom.redirect`. |
| `localePrefixes` | No prefixes                         | Requires exactly one entry per Payload locale; applies to `path` and `paths`.                |
| `overrides`      | Plugin-owned `redirects` collection | Passes Payload collection options, with plugin-controlled fields and hooks.                  |

### Collection options

Configure these centrally under `collections` or on a collection under `custom.redirect`. Globals are not supported.

| Option    | Behavior                                                                                      |
| --------- | --------------------------------------------------------------------------------------------- |
| `path`    | One site-relative template shared by all locales.                                             |
| `paths`   | One site-relative template for every Payload locale. Requires localization.                   |
| `getPath` | Synchronous callback returning a complete path or `null`; locale prefixes are not applied.    |
| `enabled` | Defaults to enabled when a strategy is set. Set `false` alone to disable automatic redirects. |

Choose exactly one of `path`, `paths`, or `getPath`. `enabled: false` cannot be combined with a path strategy. Templates must start with `/`, cannot include query strings or fragments, and use top-level field names in brackets.

### Redirect collection schema

The collection stores one global source path per rule; rules have no locale or hostname field.

| Field        | Stored value and default                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| `from`       | Required, normalized, globally unique source path; fragments are rejected.                                            |
| `to`         | Required normalized site-relative destination path.                                                                   |
| `statusCode` | Select stores `"301"` by default or `"302"`; the exported `RedirectStatusCode` type uses numeric values `301 \| 302`. |
| `enabled`    | Boolean, `true` by default; disabled rules are inactive.                                                              |
| `origin`     | `"manual"` for manual writes; `"auto"` for generated rules.                                                           |

### Access control

Reads are public by default. Manual create, update, and delete require an authenticated non-service user when access checks run. Automatic writes use an internal request context. Custom access overrides must still allow automatic create/update requests or generation will fail.

### Public types

The package exports `redirects`, `RedirectsOptions`, `RedirectCollectionOptions<TSlug>`, `RedirectOrigin` (`"manual" | "auto"`), and `RedirectStatusCode` (`301 | 302`).

## Compatibility

| Requirement                  | Support and limits                                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                      | `^22.23.5`, `^24.22.3`, or `>=26.13.1`.                                                                                                                        |
| Payload                      | `>=3.94.1 <4`.                                                                                                                                                 |
| PostgreSQL                   | Optional `@payloadcms/db-postgres` peer, `>=3.94.1 <4`; graph writes require an active Payload transaction at `READ COMMITTED`.                                |
| Other database adapters      | No equivalent concurrency guarantee is claimed; atomic graph validation is not verified.                                                                       |
| Automatic redirects          | Require `versions.drafts` on each configured collection.                                                                                                       |
| Content localization         | Uses Payload locale configuration and resolves each locale without fallback.                                                                                   |
| Localized publication status | Payload's `experimental.localizeStatus` is experimental. This package has basic integration coverage, not comprehensive per-locale publish/unpublish coverage. |
| Admin translations           | Payload Admin i18n is separate; plugin labels and validation messages are not translated by the package.                                                       |
| Frontend framework           | Framework-independent rule storage; request matching and responses remain application-owned.                                                                   |

## Documentation

- [Failure semantics](./docs/FAILURE_SEMANTICS.md)
- [Payload content localization](https://payloadcms.com/docs/configuration/localization)
- [Payload Admin i18n](https://payloadcms.com/docs/configuration/i18n)
- [Payload drafts and versions](https://payloadcms.com/docs/versions/drafts)
- [Payload Local API](https://payloadcms.com/docs/local-api/overview)

## License

[MIT](./LICENSE)
