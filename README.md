# `@klnap/payload-redirect`

Redirect management for Payload CMS with automatic redirects when published content paths change.

```ts
import { buildConfig } from "payload";
import { redirects } from "@klnap/payload-redirect";
import { Articles } from "./collections/Articles";

export default buildConfig({
  collections: [Articles],
  plugins: [redirects({ collections: { articles: { path: "/articles/[slug]" } } })],
});
```

This example assumes `articles` enables `versions.drafts`.

`/articles/old-title` → `/articles/new-title` creates `301 /articles/old-title → /articles/new-title`.

## Why?

Changing a published URL can break existing links, bookmarks, and search results. Editors must otherwise remember every old URL and create a redirect manually.

Payload's official redirects plugin already manages manual rules and document-reference destinations. This package focuses on generating redirect rules from changes to published paths, while leaving HTTP responses to your application.

Define the route once. The plugin compares complete published paths, so a change to a category, parent, or other route field can create a redirect even when the slug stays the same.

## Features

- **Automatic redirects:** Create `301` rules when a configured published path changes.
- **Full-path tracking:** Detect route changes across every field in a path template.
- **Localized paths:** Configure shared or per-locale routes without locale fallback.
- **Custom path resolution:** Derive routes from published document data.
- **Manual rule precedence:** Preserve a manual rule when automatic generation reaches the same source path.
- **Manual redirects:** Manage permanent and temporary rules in Payload Admin.
- **Redirect validation:** Enforce unique source paths and reject loops in the enabled, normalized rule graph.
- **Collection overrides:** Extend the plugin-owned collection with native Payload options.
- **Framework agnostic:** Keep request matching, caching, and HTTP responses in your application.

## Installation

```bash
bun add @klnap/payload-redirect
```

```bash
npm install @klnap/payload-redirect
```

`payload` is a required peer dependency. `@payloadcms/db-postgres` is an optional peer; install it when using PostgreSQL.

## Usage

### Manual redirects

Register `redirects()` to add the plugin-owned `redirects` collection. Manual rules need no draft configuration or automatic path options.

```ts
plugins: [redirects()],
```

Create, edit, enable, and disable manual rules in Payload Admin. Choose `301` for permanent rules or `302` for temporary rules.

The collection slug defaults to `redirects`. If another plugin or collection already uses that slug, choose a different one with `overrides.slug`.

### Automatic redirects

Enable drafts on each tracked collection. Configure a route using the full set of fields that determine its public path:

```ts
redirects({
  collections: {
    products: { path: "/shop/[category]/[slug]" },
  },
});
```

If `category` changes from `chairs` to `office-chairs`, the generated rule is:

```text
/shop/chairs/model-a → 301 → /shop/office-chairs/model-a
```

Templates use top-level field names. Each placeholder value must be a non-empty string or finite number; the plugin URL-encodes it as one path segment. Missing or invalid values skip that locale's redirect.

### Publication lifecycle

The plugin compares the current published path with earlier published versions. Draft snapshots do not create rules.

| Operation                                  | Result                                                                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| First publication                          | No redirect; there is no earlier published path.                                                                                                                                           |
| Draft save or draft path change            | No redirect.                                                                                                                                                                               |
| Publish a changed full path                | Create or update a `301` rule from the latest earlier published path with a different resolved path.                                                                                       |
| Republish without a path change            | Leave an enabled identical automatic rule unchanged. Recreate a missing rule or re-enable a disabled automatic rule from the latest earlier published path with a different resolved path. |
| Unpublish or delete a document             | Create no new rule. Existing rules are not removed.                                                                                                                                        |
| A manual rule already owns the source path | Skip the automatic write; keep the manual rule.                                                                                                                                            |
| Manually edit an automatic rule            | Change its `origin` to `manual`; automatic generation no longer updates it.                                                                                                                |

Returning to an earlier path can form a loop. For example, if `/a` redirects to `/b`, publishing the document back at `/a` attempts `/b` → `/a`. The enabled redirect graph rejects this write, and the publication fails. Resolve the conflicting rule before retrying.

Changing `path`, `paths`, or `getPath` alone does not migrate existing URLs. The active strategy resolves both the earlier and current published documents. Plan route-template migrations separately.

### Localized paths

Configure Payload localization and provide a complete `paths` entry for every locale:

```ts
redirects({
  collections: {
    articles: {
      paths: {
        en: "/articles/[slug]",
        pl: "/artykuly/[slug]",
      },
    },
  },
});
```

Use `localePrefixes` when locales share one route template:

```ts
redirects({
  localePrefixes: { en: "/en", pl: "" },
  collections: {
    articles: { path: "/articles/[slug]" },
  },
});
```

Both locale maps must contain exactly the Payload locale codes. Published paths use the requested locale without fallback. Omit `localePrefixes` for no prefix; the plugin does not infer locale prefixes.

### Custom path resolution

Use `getPath` when a template cannot express the route. Payload's generated types infer `doc` from the collection slug. The callback receives the locale-specific published document and a locale that may be `undefined`.

```ts
redirects({
  collections: {
    products: {
      getPath: ({ doc, locale }) =>
        doc.category && doc.slug
          ? `${locale ? `/${locale}` : ""}/${encodeURIComponent(String(doc.category))}/${encodeURIComponent(String(doc.slug))}`
          : null,
    },
  },
});
```

Return a complete site-relative path or `null`. The plugin does not add `localePrefixes` to callback results.

### Collection-level configuration

Put the same path options on a collection under `custom.redirect` when that fits your config:

```ts
import type { CollectionConfig } from "payload";

const Articles: CollectionConfig = {
  slug: "articles",
  versions: { drafts: true },
  custom: { redirect: { path: "/articles/[slug]" } },
  fields: [{ name: "slug", type: "text" }],
};
```

The plugin reads the path options from `custom.redirect`.

Central `collections` configuration replaces `custom.redirect`; the plugin does not merge them. Use `{ enabled: false }` to disable automatic generation for a collection while retaining manual redirects.

### Collection overrides

The plugin accepts native Payload collection options and lets you add fields:

```ts
redirects({
  overrides: {
    slug: "url-redirects",
    admin: { group: "Settings" },
    fields: ({ defaultFields }) => [...defaultFields, { name: "notes", type: "textarea" }],
  },
});
```

Keep the required default fields and their field types. The plugin retains their built-in validators, `from` uniqueness, and the `enabled` index.

### Application integration

The plugin stores rules; it does not provide a resolver, middleware, or framework adapter. Check for a redirect before serving the route or returning a not-found response.

The plugin normalizes paths when saving rules, but it does not export that normalizer or normalize lookup values. Normalize the incoming request to the same representation as the stored `from` value:

| Input            | Stored path     | Note                                                                         |
| ---------------- | --------------- | ---------------------------------------------------------------------------- |
| `/articles/old/` | `/articles/old` | Trailing slash is removed except for `/`.                                    |
| `/articles//old` | `/articles/old` | Repeated slashes collapse.                                                   |
| `/a/../b`        | `/b`            | Dot segments are resolved.                                                   |
| `/café`          | `/café`         | Unicode remains literal; percent escapes are not decoded or case-normalized. |
| `/old?x=1`       | `/old?x=1`      | Query strings are preserved and matched exactly.                             |

Matching uses exact, case-sensitive values. `new URL(request.url).pathname` may differ: it preserves repeated/trailing slashes, percent-encodes Unicode, and omits the query. `/café` and `/caf%C3%A9` remain distinct. Loop checks cover normalized stored rules, not every URL a browser or framework may treat as equivalent.

The application owns its canonicalization policy. Use the same policy for incoming requests and rule creation. Include the query string only when source rules use one.

```ts
const canonicalFrom = canonicalizeRedirectSource(request); // App-owned; match stored `from`.

const { docs } = await payload.find({
  collection: redirectsCollectionSlug,
  where: { and: [{ from: { equals: canonicalFrom } }, { enabled: { equals: true } }] },
  limit: 1,
  pagination: false,
  depth: 0,
  overrideAccess: false,
});

const rule = docs[0];
if (rule) return Response.redirect(new URL(rule.to, request.url), Number(rule.statusCode));
```

Set `redirectsCollectionSlug` to `"redirects"` unless you changed it with `overrides.slug`. Payload Local API defaults to `overrideAccess: true`; `false` enforces your collection's read access. Reads are public by default unless you override them.

## Configuration

### Plugin options

| Option           | Default                      | Behavior                                                                                    |
| ---------------- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| `collections`    | Not configured               | Maps registered collection slugs to automatic path options.                                 |
| `localePrefixes` | No prefixes                  | Maps each Payload locale to a prefix applied to `path` or `paths`.                          |
| `overrides`      | Default redirects collection | Passes native Payload collection options; supports a custom `slug` and a `fields` callback. |

### Collection options

Configure these options centrally under `collections` or locally under `custom.redirect`.

| Option    | Behavior                                                                                      |
| --------- | --------------------------------------------------------------------------------------------- |
| `path`    | One shared route template for all locales.                                                    |
| `paths`   | A complete route template for each Payload locale.                                            |
| `getPath` | A callback that returns a complete site-relative path or `null`.                              |
| `enabled` | Omit or set `true` with one path strategy; set `false` alone to disable automatic generation. |

Choose exactly one of `path`, `paths`, or `getPath`. `enabled: false` cannot be combined with a path strategy. Templates must start with `/`, cannot include query strings or fragments, and use top-level field names in brackets.

### Redirect collection

The plugin owns the collection and uses these fields:

| Field        | Default and behavior                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------ |
| `from`       | Required, unique source path. Fragments are rejected.                                            |
| `to`         | Required site-relative destination path.                                                         |
| `statusCode` | `301` by default; `302` is supported. Payload stores these select values as `"301"` and `"302"`. |
| `enabled`    | `true`; disabled rules are not active.                                                           |
| `origin`     | `manual` for manual creates and edits; `auto` for generated rules.                               |

The collection slug defaults to `redirects`. `trash` defaults to `true`, `versions` to `false`, and timestamps to `true`. Rule create/update operations normalize paths and reject duplicate normalized sources. Enabled rules are also checked for loops and chains exceeding 1,000 hops.

### Access control

Reads are public by default. Manual create, update, and delete require an authenticated non-service user. Automatic writes use an internal request context. Custom create/update access rules must also allow those internal writes. Use `overrides.access` to apply your application's access policy.

### Public types

The root export provides `redirects`, `RedirectsOptions`, `RedirectCollectionOptions<TSlug>`, `RedirectOrigin`, and `RedirectStatusCode`. `RedirectOrigin` is `"manual" | "auto"`; `RedirectStatusCode` is `301 | 302`.

## Compatibility

| Requirement               | Support                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                   | `^22.23.5`, `^24.22.3`, or `>=26.13.1`.                                                                                               |
| Payload                   | `>=3.94.1 <4`.                                                                                                                        |
| `@payloadcms/db-postgres` | Optional peer, `>=3.94.1 <4`. PostgreSQL uses a transaction-scoped advisory lock for graph checks.                                    |
| PostgreSQL transactions   | Redirect create/update operations require an active Payload request transaction at `READ COMMITTED`; otherwise the write is rejected. |
| Other database adapters   | No equivalent concurrent-write guarantee is provided.                                                                                 |
| Automatic generation      | Requires `versions.drafts` on each configured collection.                                                                             |
| Frontend framework        | Framework independent; request matching and HTTP responses remain application-owned.                                                  |

## Documentation

- [Failure semantics](./docs/FAILURE_SEMANTICS.md)
- [Payload redirects plugin](https://payloadcms.com/docs/plugins/redirects)
- [Payload drafts and versions](https://payloadcms.com/docs/versions/drafts)
- [Payload Local API](https://payloadcms.com/docs/local-api/overview)
- [Payload query language](https://payloadcms.com/docs/queries/overview)

## License

[MIT](./LICENSE)
