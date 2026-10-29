# @klnap/payload-redirect

Payload CMS plugin for **URL redirect rules** (`301` / `302`) and optional **Auto** redirects when a published identifier (for example a slug) changes.

The package manages the redirects collection, validation, Auto rules on publish, and **`resolveRedirect`** for server-side lookup. It returns `ResolvedRedirect | null` and does **not** ship HTTP middleware, caching, or framework integrations — your application performs the HTTP redirect after lookup.

## Features

- Merged **redirects** collection (fields, hooks, access defaults)
- **Manual** rules in the admin UI
- **Auto** `301` rules on published identifier transitions (opt-in per content collection)
- Optional **published path templates** for Auto `from`/`to` (locale prefixes + `[param]` segments)
- `resolveRedirect({ payload, from })`
- Path normalization on save and resolve
- Duplicate protection on `from`

## Requirements

| Requirement | Version |
|-------------|---------|
| **Node.js** | `^24.0.0` |
| **Payload** | `3.90.2` (peer; tested on this version) |

Auto redirects require **drafts/versioning** on content collections.

## Quick start

```ts
import type { CollectionConfig } from 'payload'
import { buildConfig } from 'payload'
import { redirects } from '@klnap/payload-redirect'
import { postgresAdapter } from '@payloadcms/db-postgres'

export const Redirects: CollectionConfig = {
  slug: 'redirects',
  fields: [], // host stub — see note below on merge, types, and migrations
}

export default buildConfig({
  collections: [Redirects],
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL! },
  }),
  plugins: [redirects({ collection: Redirects })],
})
```

Register `Redirects` in `config.collections` and pass the **same** object reference to `redirects({ collection })`. Do not call `createRedirectsCollection` in the host.

**Merge, types, and migrations.** During `buildConfig`, the `redirects()` plugin **replaces** the matching entry in `config.collections` with the merged collection (plugin fields, hooks, access). Payload therefore sees the full schema for admin UI, **`payload generate:types`**, and **`@payloadcms/db-postgres` migrations** — not the empty `fields: []` stub alone. Keep `redirects()` in the same config file you use for type generation and `payload migrate`. If you pre-declare plugin-owned fields on the host collection, preserve their expected types and flags; see [Redirect collection](#redirect-collection).

**PostgreSQL.** This package does not ship `withRedirectProdMigrations`, bundled SQL, or a `./migrations` export — schema changes go through Payload’s adapter. After adding the plugin, run your usual migration flow (`payload migrate:create` / `migrate` or dev push, per project). The plugin supplies the required fields with their expected index settings. If you pre-declare any plugin-owned fields in the host collection, preserve their expected types and index settings: **`from`** must be **`unique: true`**, and **`enabled`** must be **`index: true`**. The plugin sets **`unique: true`** on **`from`** without adding a separate **`index: true`**; **`enabled`** is indexed. Incompatible declarations are rejected at startup. Optional performance index for lookups: [docs/adr/0002-database-indexes.md](docs/adr/0002-database-indexes.md).

## Redirect collection

The host defines a redirects collection (slug and optional extra fields). The plugin merges required fields, hooks, and default access into that entry before Payload initializes. Incompatible host declarations of plugin-owned fields, including incorrect field types or required index settings, throw **`RedirectConfigError`** at startup.

Merged plugin fields: `from`, `to`, `StatusCode`, `enabled`, `origin`.

## Configuration

### `redirects(pluginConfig)`

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `collection` | **Yes** | — | Host redirects `CollectionConfig` (also in `config.collections`). |
| `localePrefix` | No | — | Per-locale URL prefix for Auto path building (`Record<string, string>`). |
| `trash` | No | `true` | Soft delete on merged collection unless host `collection.trash` is set. |
| `access` | No | — | Overrides for `read` / `create` / `update` / `delete`. Host collection access wins when set. |

Default access: **read** public; **create/update** authenticated user (or internal Auto context); **delete** authenticated only.

### Auto redirects on content collections

Use **one** wiring style per collection — not both. Each style registers the same `createRedirect` `afterChange` logic; combining them would run Auto twice on every publish.

| Style | When to use |
|-------|-------------|
| **Declarative** (`custom.redirect`) | Default. The `redirects()` plugin appends `afterChange` when it sees `custom.redirect` on the collection. |
| **Manual hook** (`createRedirect(...)`) | When you cannot use `custom.redirect` (generated configs, shared hook arrays) or you must control exact hook order relative to other hooks. Do **not** set `custom.redirect` on the same collection. |

**Declarative** — identifier on the collection; plugin wires the hook:

```ts
{
  slug: 'pages',
  versions: { drafts: true },
  custom: {
    redirect: {
      identifier: 'slug',
      enabled: true, // optional; default true
    },
  },
}
```

**Manual hook** — add the hook yourself; omit `custom.redirect` on that collection:

```ts
import { createRedirect } from '@klnap/payload-redirect'

hooks: {
  afterChange: [createRedirect({ identifier: 'slug' })],
}
```

### Published paths and localization

On publish, Auto compares the **previous** and **current** published identifier for each locale. The redirect rule is always **`from` → old public path**, **`to` → new public path** (both normalized). If the two paths are equal after normalization, no rule is created.

**Without** a resolvable `publishedLink` template (or when path building returns null for a side), each side falls back to the **normalized identifier value** alone (for example the slug string), not a full URL path — configure `publishedLink` when `from`/`to` must be site paths.

Templates live on the content collection under **`custom.redirect.publishedLink`**, or under **`custom.draft.publishedLink`** (same wire shape — useful when that block already exists on the collection):

```ts
custom: {
  redirect: {
    identifier: 'slug',
    publishedLink: {
      path: '/articles/[slug]',
      paths: { pl: '/artykuly/[slug]' },
      params: { slug: { field: 'slug', localized: true } },
    },
  },
},
```

Set plugin **`localePrefix`** when paths include locale segments (merged with link config):

```ts
redirects({
  collection: Redirects,
  localePrefix: { en: '', pl: '/pl' },
})
```

Redirect **documents** have no locale field; each rule is one path identity. Identifier transitions are evaluated **per locale** on publish.

### Request context

Export **`REDIRECT_CONTEXT_KEYS`** from the main entry:

| Key | Value | Effect |
|-----|-------|--------|
| `skipAuto` | `payloadRedirectSkipAuto` | Skips Auto redirect creation |
| `internal` | `payloadRedirectInternal` | Internal writes; sets origin **Auto** |

Set these flags only in **trusted server code** (Local API, background jobs) on `req.context`. Never copy values from request bodies, query strings, or other client-controlled input — a user could otherwise bypass Auto redirect creation or forge internal writes.

Use **`skipAuto`** when an import or job must not create Auto rules. Use **`internal`** together with server-side redirect writes so origin is recorded as **Auto**.

## Admin usage

| Field | Description |
|-------|-------------|
| **from** | Source path or URL; unique. |
| **to** | Destination; required for `301` / `302`. |
| **StatusCode** | `301` (default) or `302`; both require **to**. |
| **enabled** | Disabled rules are ignored by `resolveRedirect`. |
| **origin** | Read-only **Manual** (`manual`) or **Auto** (`auto`). |

Rules created in the admin UI are **Manual**. Duplicate `from`: *A redirect rule already exists for this source path*.

## Auto redirects

Created on publish when a published identifier transition is detected (`origin` **Auto**, `301`, enabled). See [Published paths and localization](#published-paths-and-localization) for how `from`/`to` are computed.

**Not created:** draft saves, first publication, `payloadRedirectSkipAuto`, unpublished docs, unchanged identifier, invalid/empty paths, document delete, or when **Manual** rule already owns `from`.

**Updated:** existing **Auto** rule on same `from` when `to` changes.

## Redirect resolution (host responsibility)

```ts
import { resolveRedirect } from '@klnap/payload-redirect'

const result = await resolveRedirect({
  payload,
  from: requestPathname,
})
// { statusCode: 301 | 302; to: string } | null
```

Your framework (Next.js, Express, etc.) must call `resolveRedirect` and apply the HTTP redirect response. This package does not intercept requests.

- Normalizes `from` before lookup.
- **`null`:** no enabled rule — serve normal content or 404.
- **`RedirectAmbiguousRuleError`:** more than one match (data issue).
- Does not follow redirect chains; the returned **`to`** is not resolved recursively (your app may call `resolveRedirect` again if you implement chaining yourself).

## Security and access

- Default **read** on redirect fields is public so `resolveRedirect` and list filters work; tighten with plugin `access` or host collection access if your threat model requires it.
- Auto creates use internal context and authenticated access paths; see [docs/FAILURE_SEMANTICS.md](docs/FAILURE_SEMANTICS.md).

## Errors

See [docs/FAILURE_SEMANTICS.md](docs/FAILURE_SEMANTICS.md).

## Public API

### `@klnap/payload-redirect`

`redirects`, `RedirectsPluginConfig`, `createRedirect`, `CreateRedirectOptions`, `resolveRedirect`, `ResolveRedirectArgs`, `ResolvedRedirect`, `RedirectOrigin`, `RedirectStatusCode`, `RedirectsCollectionAccess`, `REDIRECT_CONTEXT_KEYS`, `RedirectConfigError`, `RedirectValidationError`, `RedirectAmbiguousRuleError`.

## Troubleshooting

| Symptom | Cause |
|---------|--------|
| Plugin runtime missing | `redirects()` not in config |
| Requires `collection` | Missing `redirects({ collection })` |
| No Auto rule | Draft/first publish/skip context/no transition |
| Auto skipped | Manual rule on same `from` |
| Auto runs twice on publish | Both `custom.redirect` and `createRedirect` hook on the same collection — pick one wiring style |
| Auto paths are raw slugs | No published-link template or path build returned null — add `publishedLink` or check `params` |

## Package development

```bash
bun run test:unit
bun run test:arch
bun run check:exports
bun run check:boundaries
```

Integration tests need **`PAYLOAD_REDIRECT_TEST_DATABASE_URL`**.

## Further reading

- [docs/FAILURE_SEMANTICS.md](docs/FAILURE_SEMANTICS.md)
- [docs/adr/0002-database-indexes.md](docs/adr/0002-database-indexes.md)

## License

MIT — see [LICENSE](./LICENSE).
