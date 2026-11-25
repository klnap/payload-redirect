# @klnap/payload-redirect

Use this plugin when redirect rules must track published identifier changes, including localized paths. It adds a managed redirects collection, optional automatic rules on publish, validation, and a resolver for your application to call.

Rules use HTTP `301` or `302`. The resolver returns `ResolvedRedirect | null`; it does **not** ship HTTP middleware, caching, or framework integrations. Your application applies the HTTP redirect after lookup.

```ts
import { redirects } from '@klnap/payload-redirect'

// Redirects is your host application's collection configuration.
// Add to your Payload config:
const plugins = [redirects({ collection: Redirects })]
```

## Install

Install the package in your Payload application:

```sh
npm install @klnap/payload-redirect
# or
bun add @klnap/payload-redirect
```

The host must provide Payload and the PostgreSQL adapter. See [Requirements](#requirements) and [Quick start](#quick-start).

## Requirements

| Requirement | Version                                                       |
| ----------- | ------------------------------------------------------------- |
| **Node.js** | `^24.22.3 or >=26.13.1`                                       |
| **Payload** | `>=3.94.1 <4` (peer), `@payloadcms/db-postgres` `>=3.94.1 <4` |

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

**PostgreSQL.** The package adds no migrations and does not wrap the adapter. The host application owns its migrations. Schema changes go through Payload's migration flow (`payload migrate:create` and `migrate`, or dev push, per project).

## Redirect collection

The host defines a redirects collection (slug and optional extra fields). The plugin merges required fields, hooks, and default access into that entry before Payload initializes. Incompatible host declarations of plugin-owned fields, including incorrect field types or required index settings, throw **`RedirectConfigError`** at startup.

Merged plugin fields: `from`, `to`, `StatusCode`, `enabled`, `origin`.

## Configuration

### `redirects(pluginConfig)`

| Option         | Required | Default | Description                                                                                  |
| -------------- | -------- | ------- | -------------------------------------------------------------------------------------------- |
| `collection`   | **Yes**  | —       | Host redirects `CollectionConfig` (also in `config.collections`).                            |
| `localePrefix` | No       | —       | Per-locale URL prefix for Auto path building (`Record<string, string>`).                     |
| `trash`        | No       | `true`  | Soft delete on merged collection unless host `collection.trash` is set.                      |
| `access`       | No       | —       | Overrides for `read` / `create` / `update` / `delete`. Host collection access wins when set. |

Default access: **read** is public. **create** and **update** need a signed-in user or the internal Auto context. **delete** needs a signed-in user. A host collection's own `access` handler takes precedence over the plugin `access` option.

### Auto redirects on content collections

Use **one** wiring style per collection — not both. Each style registers the same `createRedirect` `afterChange` logic; combining them would run Auto twice on every publish.

| Style                                   | When to use                                                                                                                                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Declarative** (`custom.redirect`)     | Default. The `redirects()` plugin appends `afterChange` when it sees `custom.redirect` on the collection.                                                                                            |
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

| Key        | Value                     | Effect                                |
| ---------- | ------------------------- | ------------------------------------- |
| `skipAuto` | `payloadRedirectSkipAuto` | Skips Auto redirect creation          |
| `internal` | `payloadRedirectInternal` | Internal writes; sets origin **Auto** |

Set these flags only in **trusted server code** (Local API, background jobs) on `req.context`. Never copy values from request bodies, query strings, or other client-controlled input — a user could otherwise bypass Auto redirect creation or forge internal writes.

Use **`skipAuto`** when an import or job must not create Auto rules. Use **`internal`** together with server-side redirect writes so origin is recorded as **Auto**.

## Admin usage

| Field          | Description                                            |
| -------------- | ------------------------------------------------------ |
| **from**       | Site-relative source path; unique.                     |
| **to**         | Site-relative destination; required for `301` / `302`. |
| **StatusCode** | `301` (default) or `302`; both require **to**.         |
| **enabled**    | Disabled rules are ignored by `resolveRedirect`.       |
| **origin**     | Read-only **Manual** (`manual`) or **Auto** (`auto`).  |

Rules created in the admin UI are **Manual**. Duplicate `from`: _A redirect rule already exists for this source path_.

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
- Matching is case-sensitive and does not decode percent escapes; pass the same path representation used when saving the rule.
- Query strings are matched exactly. Source fragments are rejected because HTTP requests do not send them.
- Literal and percent-encoded dot segments normalize to their browser-equivalent path (for example, `/a/../b` becomes `/b`). Other percent escapes and Unicode remain literal.
- Saving an enabled rule rejects destinations whose existing redirect chain loops or exceeds 1,000 hops.
- **`null`:** no enabled rule — serve normal content or 404.
- **`RedirectAmbiguousRuleError`:** more than one match (data issue).
- Does not follow redirect chains; the returned **`to`** is not resolved recursively (your app may call `resolveRedirect` again if you implement chaining yourself).

## Security and access

- Default **read** on redirect fields is public so `resolveRedirect` and list filters work; tighten with plugin `access` or host collection access if your threat model requires it.
- Auto writes run with `overrideAccess: false` and the internal context (`payloadRedirectInternal`). They pass create and update access only through that context. Delete access still needs a user. See [docs/FAILURE_SEMANTICS.md](docs/FAILURE_SEMANTICS.md).
- Default **create**, **update** and **delete** of manual rules accept only a signed-in human (`req.user` with a type other than `service`). Service principals are refused by default, so automation cannot write manual rules. Package-internal automatic writes are unaffected. A host that deliberately lets a service principal manage manual rules grants it explicitly through the plugin's `access` option, one operation at a time. The override applies only to the operations it names:

```ts
redirects({
  access: {
    // Automation may create manual rules. Update and delete stay human-only.
    create: ({ req }) => (req.user as { type?: string } | null)?.type === 'service',
  },
})
```

Keep such a grant as narrow as the automation needs, and check the service identity itself (for example its token holder) inside the function.

## Errors

See [docs/FAILURE_SEMANTICS.md](docs/FAILURE_SEMANTICS.md).

## Public API

### `@klnap/payload-redirect`

`redirects`, `RedirectsPluginConfig`, `createRedirect`, `CreateRedirectOptions`, `resolveRedirect`, `ResolveRedirectArgs`, `ResolvedRedirect`, `RedirectOrigin`, `RedirectStatusCode`, `RedirectsCollectionAccess`, `REDIRECT_CONTEXT_KEYS`, `RedirectConfigError`, `RedirectValidationError`, `RedirectAmbiguousRuleError`.

## Troubleshooting

| Symptom                    | Cause                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| Plugin runtime missing     | `redirects()` not in config                                                                     |
| Requires `collection`      | Missing `redirects({ collection })`                                                             |
| No Auto rule               | Draft/first publish/skip context/no transition                                                  |
| Auto skipped               | Manual rule on same `from`                                                                      |
| Auto runs twice on publish | Both `custom.redirect` and `createRedirect` hook on the same collection — pick one wiring style |
| Auto paths are raw slugs   | No published-link template or path build returned null — add `publishedLink` or check `params`  |

## Further reading

- [docs/FAILURE_SEMANTICS.md](docs/FAILURE_SEMANTICS.md)
- [docs/adr/0002-database-indexes.md](docs/adr/0002-database-indexes.md)

## License

MIT — see [LICENSE](./LICENSE).
