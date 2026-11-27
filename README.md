# `@klnap/payload-redirect`

Redirect management for Payload CMS. When a published Collection or Global path changes, the plugin stores a permanent redirect from the old path to the new one. Editors can also create manual `301` and `302` rules in the Payload Admin.

The plugin stores rules. Your application matches incoming requests and sends the response. A complete Next.js example is in [Serving redirects](#serving-redirects).

```text
/articles/guides/getting-started-with-payload
→ /articles/tutorials/getting-started-with-payload (301)
```

## Features

- **Automatic `301`s** when a published path changes, including changes that do not touch the slug, such as a category.
- **Configuration beside the schema** with `custom.redirect` on each Collection or Global.
- **Complete-path tracking** through a path template or a typed `getPath` callback.
- **Native localization** with per-locale templates, explicit prefixes, and no locale fallback.
- **Globals** with the same publication and redirect rules as Collections.
- **Manual rules** in the Payload Admin, enabled or disabled, with no automatic configuration.
- **Safe writes**: duplicate and cyclic rules are rejected, and manual rules are never overwritten.
- **No runtime dependencies** beyond the Payload peer.

## Contents

- [Installation](#installation)
- [Complete example](#complete-example)
- [How it works](#how-it-works)
- [Configuration](#configuration)
- [Localization](#localization)
- [Globals](#globals)
- [Manual redirects](#manual-redirects)
- [Serving redirects](#serving-redirects)
- [Overrides and access](#overrides-and-access)
- [Reference](#reference)
- [Compatibility](#compatibility)
- [Limitations](#limitations)
- [Documentation](#documentation)

## Installation

```bash
bun add @klnap/payload-redirect
```

```bash
npm install @klnap/payload-redirect
```

`payload` is a required peer. `@payloadcms/db-postgres` is an optional peer, needed only with PostgreSQL.

## Complete example

These four files form a working setup for a Payload 3 app with Next.js 16 (App Router) and PostgreSQL. Each one is complete. The `custom` key is the extension point: Payload stores it as-is on collections, globals, and fields. This plugin reads only `custom.redirect`. You can use other `custom` keys for your own metadata.

### 1. `src/payload.config.ts`

```ts
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";
import { redirects } from "@klnap/payload-redirect";
import { Articles } from "./collections/Articles";
import { About } from "./globals/About";

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET ?? "",
  editor: lexicalEditor(),
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URI },
  }),
  localization: {
    locales: ["en", "fr", "de"],
    defaultLocale: "en",
  },
  collections: [Articles],
  globals: [About],
  plugins: [
    redirects({
      localePrefixes: { en: "", fr: "/fr", de: "/de" },
    }),
  ],
});
```

`redirects()` is called once. It adds the `redirects` collection, the publication hooks, and the locale prefixes.

### 2. `src/collections/Articles.ts`

```ts
import type { CollectionConfig } from "payload";
import type { RedirectCollectionOptions } from "@klnap/payload-redirect";

export const Articles: CollectionConfig = {
  slug: "articles",
  versions: { drafts: true },
  admin: { useAsTitle: "title" },
  fields: [
    { name: "title", type: "text", required: true, localized: true },
    { name: "slug", type: "text", required: true, localized: true },
    { name: "category", type: "text", required: true },
  ],
  custom: {
    redirect: {
      paths: {
        en: "/articles/[slug]",
        fr: "/actualites/[slug]",
        de: "/artikel/[slug]",
      },
    } satisfies RedirectCollectionOptions<"articles">,
  },
};
```

Tracked collections need `versions: { drafts: true }`. The `satisfies` clause types the route against this collection. Use `paths` because the collection is localized. Locales in `paths` must match `localization.locales` exactly.

### 3. `src/globals/About.ts`

```ts
import type { GlobalConfig } from "payload";
import type { RedirectGlobalOptions } from "@klnap/payload-redirect";

export const About: GlobalConfig = {
  slug: "about",
  versions: { drafts: true },
  fields: [{ name: "slug", type: "text", required: true, localized: true }],
  custom: {
    redirect: {
      getPath: ({ doc, locale }) => `${locale === "fr" ? "/fr" : ""}/${doc.slug}`,
    } satisfies RedirectGlobalOptions<"about">,
  },
};
```

`getPath` returns the complete path. The plugin does not add prefixes to it, so the French prefix is added here.

### 4. `src/proxy.ts`

Next.js 16 runs `proxy.ts` on the Node.js runtime by default, so it can use Payload's Local API. Redirects are sent from here with the status stored on the rule.

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import payloadConfig from "@payload-config";

function normalizeRequestPath(pathname: string): string {
  const collapsed = pathname.replace(/\/{2,}/g, "/");
  return collapsed.length > 1 && collapsed.endsWith("/") ? collapsed.slice(0, -1) : collapsed;
}

function decodeSafely(value: string): string {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

export async function proxy(request: NextRequest) {
  const pathname = normalizeRequestPath(request.nextUrl.pathname);
  const candidates = [...new Set([pathname, decodeSafely(pathname)])];

  const payload = await getPayload({ config: payloadConfig });
  const { docs } = await payload.find({
    collection: "redirects",
    where: {
      and: [{ from: { in: candidates } }, { enabled: { equals: true } }],
    },
    limit: 1,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });

  const rule = docs[0];
  if (!rule) return NextResponse.next();

  return NextResponse.redirect(new URL(rule.to, request.url), Number(rule.statusCode) as 301 | 302);
}

export const config = {
  matcher: ["/((?!api|admin|_next/static|_next/image|favicon.ico).*)"],
};
```

`@payload-config` is the alias that the Payload Next.js template sets up. It points to your `payload.config.ts`. The lookup runs on every matched request, so keep the matcher narrow for your public routes. See [Serving redirects](#serving-redirects) for the path rules.

## How it works

The plugin compares the complete public path of the newly published version with the path of the previously published version. It does not compare slugs alone.

| Event                                                              | Result                                                                      |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| First publication                                                  | No rule.                                                                    |
| Draft save                                                         | No rule.                                                                    |
| Republication, path unchanged                                      | An identical enabled automatic rule is left as is.                          |
| Republication, path changed                                        | A `301` from the old path to the new one is created or updated and enabled. |
| Previous published version has no resolvable path in a locale      | That locale is skipped.                                                     |
| A manual rule already owns the source path                         | The automatic write is skipped and the manual rule stays unchanged.         |
| Editor edits or manually disables an automatic rule                | Its origin becomes `manual`, and later publications no longer manage it.    |
| Unpublish or delete                                                | No new rule. Existing rules stay.                                           |
| Return to an earlier path that would close a loop in enabled rules | The write is rejected and the publication fails.                            |

Route changes do not migrate historical URLs. Add manual rules for older paths if you need them.

## Configuration

You can configure automatic redirects in two places. Use `custom.redirect` by default.

### `custom.redirect` on the entity

Each Collection or Global gets its own `custom.redirect` object. The plugin reads it when Payload builds the config, so the route sits next to the fields it uses.

| Option    | Type                                  | Description                                                                                                     |
| --------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `path`    | `string`                              | One site-relative template for all locales. Starts with `/`; no query string or fragment.                       |
| `paths`   | `Record<Locale, string>`              | One template per Payload locale. Requires `localization`. Must cover every locale exactly.                      |
| `getPath` | `({ doc, locale }) => string \| null` | Synchronous callback for conditional routes. Returns a complete site-relative path, or `null` to skip a locale. |
| `enabled` | `boolean`                             | Defaults to `true` when a strategy is set. `false` alone keeps manual redirects and stops generation.           |

Use exactly one of `path`, `paths`, or `getPath`. `enabled: false` cannot be combined with a strategy.

Type the option with `RedirectCollectionOptions<"articles">` for a Collection or `RedirectGlobalOptions<"about">` for a Global. Both are generic over the slug, so `doc` in `getPath` has that entity's fields.

**`path`** uses top-level field names in brackets. Each value must be a non-empty string or finite number. The plugin encodes it as one path segment:

```ts
// src/collections/Articles.ts (custom only)
custom: {
  redirect: {
    path: "/articles/[category]/[slug]",
  } satisfies RedirectCollectionOptions<"articles">,
},
```

A missing or unsafe value skips path resolution for that locale.

**`getPath`** handles conditional routes. Here is a complete collection with it:

```ts
// src/collections/Articles.ts
import type { CollectionConfig } from "payload";
import type { RedirectCollectionOptions } from "@klnap/payload-redirect";

export const Articles: CollectionConfig = {
  slug: "articles",
  versions: { drafts: true },
  admin: { useAsTitle: "title" },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", required: true },
    { name: "category", type: "text", required: true },
  ],
  custom: {
    redirect: {
      getPath: ({ doc }) => {
        if (!doc.category || !doc.slug) return null;

        const category = encodeURIComponent(doc.category);
        const slug = encodeURIComponent(doc.slug);

        return doc.category === "interviews"
          ? `/interviews/${slug}`
          : `/articles/${category}/${slug}`;
      },
    } satisfies RedirectCollectionOptions<"articles">,
  },
};
```

The callback is synchronous. The plugin does not add locale prefixes to its result, so add them yourself when you need them. Return `null` to skip a locale. An exception thrown by the callback is not converted to a skip.

### Central configuration: `redirects()`

You can also configure entities in the plugin call. This is useful when you cannot edit the Collection or Global, or when the route is a site-wide decision:

```ts
redirects({
  localePrefixes: { en: "", fr: "/fr", de: "/de" },
  collections: {
    articles: { path: "/articles/[category]/[slug]" },
  },
  globals: {
    about: { path: "/[slug]" },
  },
});
```

**Precedence.** A central entry replaces that entity's `custom.redirect`. The two are never merged. Central `collections` and `globals` maps are independent, even when their slugs match.

## Localization

The plugin uses Payload's native content localization. The complete setup is in [Complete example](#complete-example): `localization` in `buildConfig`, localized fields in the collection, and a `paths` map in `custom.redirect`.

With those templates, the same article resolves to:

| Locale | Published slug                 | Public path                                |
| ------ | ------------------------------ | ------------------------------------------ |
| `en`   | `getting-started-with-payload` | `/articles/getting-started-with-payload`   |
| `fr`   | `premiers-pas-avec-payload`    | `/fr/actualites/premiers-pas-avec-payload` |
| `de`   | `erste-schritte-mit-payload`   | `/de/artikel/erste-schritte-mit-payload`   |

Publishing a new French slug `introduction-a-payload` creates only this redirect:

```text
/fr/actualites/premiers-pas-avec-payload
→ /fr/actualites/introduction-a-payload (301)
```

Rules:

- `path` shares one template across locales. `paths` gives one per locale.
- `localePrefixes` prefixes either template strategy. It must list every Payload locale.
- `paths` and `localePrefixes` must match `localization.locales` exactly.
- Without localization, use `path` or `getPath` and omit `localePrefixes`.
- Generation reads current and historical published documents with fallback disabled. A locale without a slug is skipped. The plugin never borrows another locale's slug.
- Redirect rules have no locale or domain scope. Localized routes need distinct source paths when they need different destinations.
- Payload content localization translates article data. Payload `i18n` translates the Admin UI. Plugin labels and validation messages are English.

## Globals

Globals use the same publication, localization, path validation, and storage as Collections. The complete Global setup is in [Complete example](#complete-example). Give the Global `versions: { drafts: true }` and a `custom.redirect` entry, or configure it centrally:

```ts
redirects({
  globals: {
    about: { path: "/[slug]" },
  },
});
```

## Manual redirects

`redirects()` registers the plugin-owned `redirects` collection. Create, edit, enable, or disable manual rules in the Payload Admin. Manual rules need no automatic configuration.

- `from` is a normalized site-relative path. Duplicates are rejected.
- `to` is a normalized site-relative path that differs from `from`. Absolute URLs are not accepted here.
- `statusCode` is `301` (default) or `302`.
- `enabled` defaults to `true`. `origin` is `manual` for rules you create and `auto` for generated ones.

Register `redirects()` once. A second registration throws. The collection slug defaults to `redirects`. Change it with `overrides.slug` if that slug is taken.

## Serving redirects

The plugin stores rules and does not send responses. The [complete example](#complete-example) shows `src/proxy.ts`, which looks up the rule and returns the redirect with its stored status.

Stored rules use the plugin's normalization, and `URL.pathname` alone does not match it. The lookup in `proxy.ts` applies the same rules to the request path:

| Input                    | Stored source                        |
| ------------------------ | ------------------------------------ |
| `/articles/old/`         | `/articles/old`                      |
| `/articles//old`         | `/articles/old`                      |
| `/a/../b`                | `/b`                                 |
| `/café`                  | `/café` (distinct from `/caf%C3%A9`) |
| `/articles/old?ref=mail` | `/articles/old?ref=mail`             |

Normalization trims whitespace, adds a leading slash, collapses repeated slashes, resolves `.` and `..` segments (including percent-encoded forms), and removes a trailing slash except at `/`. It preserves Unicode, percent encoding, and query strings. Fragments are rejected.

The example looks up the pathname only, so rules with a query string never match. If you need them, add the query string to the lookup yourself. Lookup compares the stored value exactly, so case and encoding matter.

## Overrides and access

`overrides` passes native Payload collection options to the plugin-owned collection. This example renames it, moves it into a group, adds a field, and makes it readable:

```ts
// payload.config.ts
redirects({
  localePrefixes: { en: "", fr: "/fr", de: "/de" },
  overrides: {
    slug: "url-redirects",
    admin: { group: "Settings" },
    access: {
      read: () => true,
    },
    fields: ({ defaultFields }) => [...defaultFields, { name: "editorNote", type: "textarea" }],
  },
});
```

If you rename the collection, change the collection name in `proxy.ts` to match: `collection: "url-redirects"`.

The plugin keeps its required fields, their types, built-in validators, `from` uniqueness, and the `enabled` index. It appends its own hooks. Access follows Payload's native defaults unless you set `overrides.access`.

Automatic generation runs trusted server-side Local API operations with `overrideAccess: true`. REST, GraphQL, and user-scoped Local API requests remain subject to your access rules. The example above makes every rule readable by anyone, including through the API. Keep the default unless you want that.

## Reference

### Plugin options

| Option           | Default                             | Description                                                                          |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------------------------ |
| `collections`    | None                                | Central opt-in for Collections. Replaces each entity's `custom.redirect`.            |
| `globals`        | None                                | Central opt-in for Globals. Replaces each entity's `custom.redirect`.                |
| `localePrefixes` | No prefixes                         | One prefix per Payload locale, applied to `path` and `paths`.                        |
| `overrides`      | Plugin-owned `redirects` collection | Native collection options, plus `fields` for extra fields. Required fields are kept. |

### Rule fields

| Field        | Type                 | Default  | Description                                                    |
| ------------ | -------------------- | -------- | -------------------------------------------------------------- |
| `from`       | `string`             | Required | Unique normalized site-relative source path. No fragment.      |
| `to`         | `string`             | Required | Normalized site-relative destination. Must differ from `from`. |
| `statusCode` | `"301" \| "302"`     | `"301"`  | Redirect status.                                               |
| `enabled`    | `boolean`            | `true`   | Disabled rules are not used for lookup or loop checks.         |
| `origin`     | `"manual" \| "auto"` | `manual` | Whether the plugin manages the rule.                           |

Enabled rules are checked for loops and for chains longer than 1,000 hops at write time. The check does not see loops created by host routing, external redirects, or browser URL equivalence.

### Exports

| Export                      | Kind  | Purpose                                                     |
| --------------------------- | ----- | ----------------------------------------------------------- |
| `redirects`                 | Value | Returns the Payload plugin.                                 |
| `RedirectsOptions`          | Type  | Options for `redirects()`.                                  |
| `RedirectCollectionOptions` | Type  | Options for a Collection, generic over the collection slug. |
| `RedirectGlobalOptions`     | Type  | Options for a Global, generic over the global slug.         |
| `RedirectOrigin`            | Type  | `"manual" \| "auto"`.                                       |
| `RedirectStatusCode`        | Type  | `301 \| 302`.                                               |

## Compatibility

| Requirement                  | Support                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js                      | `^22.23.5`, `^24.22.3`, or `>=26.13.1`.                                                                                                                                                                |
| Payload                      | Tested with Payload `3.94.1` and `3.93.0`: unit and integration tests pass on both. Declared peer range is `>=3.94.1 <4`. Older 3.x versions should work too, but this repository has not tested them. |
| PostgreSQL                   | Optional `@payloadcms/db-postgres` peer, `>=3.94.1 <4`. Integration tests run against PostgreSQL 16. Rule-graph writes run in a Payload transaction at `READ COMMITTED`.                               |
| Other database adapters      | Not verified. No equivalent concurrency guarantee is claimed.                                                                                                                                          |
| Automatic redirects          | Require `versions.drafts` on each configured Collection or Global.                                                                                                                                     |
| Content localization         | Requires `localization.locales` and `localization.defaultLocale`. Each locale resolves without fallback.                                                                                               |
| Localized publication status | Opt-in with `experimental.localizeStatus: true` and `versions.drafts.localizeStatus: true`. Payload marks this feature experimental; this package's per-locale coverage is basic.                      |
| Frontend framework           | The rule store is framework-independent. The serving example targets Next.js 16.                                                                                                                       |

## Limitations

- Route changes do not migrate historical URLs. Add manual rules for older paths.
- Rules have no locale, domain, or host scope.
- Cycle detection covers enabled stored rules only.
- Request matching, caching, and HTTP responses are the application's responsibility. The lookup in `proxy.ts` runs on every matched request.

## Documentation

- [Failure semantics](./docs/FAILURE_SEMANTICS.md): exact behavior for each configuration and write error.
- [Releasing](./docs/RELEASING.md): release process for maintainers.
- [Payload content localization](https://payloadcms.com/docs/configuration/localization)
- [Payload localized publication status](https://payloadcms.com/docs/configuration/localization#status-localization)
- [Payload drafts and versions](https://payloadcms.com/docs/versions/drafts)
- [Payload Local API](https://payloadcms.com/docs/local-api/overview)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Report security issues through [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE)
