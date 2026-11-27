# `@klnap/payload-redirect`

Generate and manage redirect rules when published collection URLs change. Your application matches requests and sends the HTTP redirects.

Automatic rules track complete published paths and use Payload's native content localization.

For a collection named `articles`, configure a route:

```ts
import { redirects } from "@klnap/payload-redirect";

redirects({
  collections: {
    articles: {
      path: "/articles/[slug]",
    },
  },
});
```

Register the returned plugin in `buildConfig({ plugins: [...] })`; the collection needs `versions.drafts`.

```text
/articles/getting-started-with-payload → /articles/building-your-first-payload-site (301)
```

## Why?

Published URL changes can break inbound links, bookmarks, and search results. Creating a redirect for every change by hand is repetitive and easy to miss.

The plugin compares resolved paths from Payload's published versions. Changing a category can create a redirect even when the slug stays the same.

## Features

- Generate permanent rules when a published article path changes.
- Track complete paths built from fields such as `category` and `slug`.
- Use Payload content localization with translated templates and explicit locale prefixes.
- Manage manual `301` and `302` rules in Payload Admin.
- Resolve conditional routes with typed `getPath` callbacks.
- Preserve manual rules and reject redirect loops.
- Customize the plugin-owned collection with Payload options and extra fields.

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

Register each tracked collection in Payload.

Configure routes centrally with `redirects({ collections })` or beside the collection in `custom.redirect`.

The plugin compares complete paths from published versions. First publication and draft saves create no rules; a changed published path creates or updates a permanent `301`.

An unchanged republish keeps its identical rule. It recreates a missing rule or re-enables a disabled automatic rule when an earlier published path differs. Unpublishing or deleting creates no new rule; existing rules remain.

Manual rules win when an automatic change reaches their source path. A generated loop rejects publication. Editing an automatic rule makes it manual; route changes do not migrate historical URLs.

### Manual redirects

`redirects()` also registers the plugin-owned collection. Create, edit, enable, or disable manual `301` and `302` rules in Payload Admin.

The collection slug defaults to `redirects`. Use `overrides.slug` if that slug is already taken. Manual rules need no automatic path configuration.

### Full-path tracking

An `articles` collection can build a route from its `category` and `slug` fields:

```ts
redirects({
  collections: {
    articles: {
      path: "/articles/[category]/[slug]",
    },
  },
});
```

If “Getting started with Payload” has slug `getting-started-with-payload`, changing its category from `guides` to `tutorials` creates a redirect even though the slug stays unchanged:

```text
/articles/guides/getting-started-with-payload
→ /articles/tutorials/getting-started-with-payload (301)
```

Templates use top-level fields from the article. Each value must be a non-empty string or finite number; the plugin encodes it as one path segment. Missing or unsafe values skip that locale's redirect.

### Localization

The plugin uses Payload's native content localization. Configure translated templates and explicit prefixes:

```ts
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
});
```

Register the returned plugin in Payload and localize the article's `slug` field. Use the central example above or the equivalent `custom.redirect` config below.

These templates resolve to:

| Locale | Published article slug         | Public path                              |
| ------ | ------------------------------ | ---------------------------------------- |
| `en`   | `getting-started-with-payload` | `/articles/getting-started-with-payload` |
| `pl`   | `pierwsze-kroki-z-payload`     | `/pl/artykuly/pierwsze-kroki-z-payload`  |
| `de`   | `erste-schritte-mit-payload`   | `/de/artikel/erste-schritte-mit-payload` |

Publishing a new Polish slug `wprowadzenie-do-payload` creates only this redirect:

```text
/pl/artykuly/pierwsze-kroki-z-payload
→ /pl/artykuly/wprowadzenie-do-payload (301)
```

English and German paths stay unchanged. `path` shares one template across locales; `paths` supplies one per locale. `localePrefixes` prefixes either template strategy and must include every Payload locale. The plugin never infers prefixes or applies `localePrefixes` to `getPath`.

`paths` requires Payload localization. Each `paths` and `localePrefixes` map must match `localization.locales` exactly. Without localization, use `path` and omit `localePrefixes`.

The plugin reads current and historical published documents with fallback disabled. If an article has no slug in a locale, that locale's redirect is skipped rather than borrowing another locale's slug.

Payload content localization translates article data; Payload `i18n` translates the Admin interface. Plugin labels and validation messages are English.

Redirect rules have no locale or domain scope. Their `from` path is globally unique, so translated routes need distinct prefixes when they must redirect to different destinations.

### Custom path resolution

Use `getPath` when a category needs a special editorial route. The `Articles` schema below defines both fields:

```ts
redirects({
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
});
```

The synchronous callback receives a typed article and `TypedLocale | undefined`; it returns the complete site-relative path or `null`. It routes interviews to `/interviews/[slug]` and other articles to `/articles/[category]/[slug]`. It adds locale prefixes itself: English stays unprefixed, while Polish and German use `/pl` and `/de`. Dynamic segments are encoded.

### Collection-level configuration

Put route configuration on the collection to keep it beside the schema:

```ts
import { redirects, type RedirectCollectionOptions } from "@klnap/payload-redirect";
import type { CollectionConfig } from "payload";

export const Articles: CollectionConfig = {
  slug: "articles",
  versions: { drafts: true },
  fields: [
    { name: "title", type: "text", localized: true },
    { name: "slug", type: "text", required: true, localized: true },
    { name: "category", type: "text", required: true },
  ],
  custom: {
    redirect: {
      paths: {
        en: "/articles/[slug]",
        pl: "/artykuly/[slug]",
        de: "/artikel/[slug]",
      },
    } satisfies RedirectCollectionOptions<"articles">,
  },
};

export const articleRedirectPlugin = redirects({
  localePrefixes: { en: "", pl: "/pl", de: "/de" },
});
```

Register the plugin in the same Payload config as `Articles`: `plugins: [articleRedirectPlugin]`. Set `localization.locales` to `["en", "pl", "de"]`; `slug` is localized in the schema. This produces the same public paths as the central example. The collection option also accepts `path`, `getPath`, and `{ enabled: false }`.

Central `collections` configuration takes precedence and replaces `custom.redirect`; the two are not merged. Set `{ enabled: false }` centrally or on the collection to disable automatic generation while retaining manual redirects.

Automatic redirect generation supports Collections only. Payload Globals are not supported.

### Collection overrides

Pass native collection options, choose a slug and Admin group, or add fields:

```ts
redirects({
  overrides: {
    slug: "url-redirects",
    admin: { group: "Settings" },
    fields: ({ defaultFields }) => [...defaultFields, { name: "editorNote", type: "textarea" }],
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

Run the redirect in your request handler:

```ts
const canonicalFrom = new URL(request.url).pathname;
const rule = await findRedirect(payload, canonicalFrom);

if (rule) {
  return Response.redirect(
    new URL(rule.to, request.url),
    Number(rule.statusCode),
  );
}
```

Rule writes remove trailing slashes, collapse repeated slashes, resolve dot segments, and preserve query strings. For example, `/articles/guides/getting-started-with-payload/` is stored without its trailing slash. Lookups are exact and case-sensitive; the plugin does not normalize request paths. Query strings remain part of the source and must match exactly. `URL.pathname` excludes them and percent-encodes Unicode, so choose a matching canonicalization policy.

## Configuration

### Plugin options

| Option           | Default                             | Behavior                                                                                     |
| ---------------- | ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `collections`    | None                                | Centrally opts registered collections into automatic redirects; overrides `custom.redirect`. |
| `localePrefixes` | No prefixes                         | Requires exactly one entry per Payload locale; applies to `path` and `paths`.                |
| `overrides`      | Plugin-owned `redirects` collection | Passes Payload collection options, with plugin-controlled fields and hooks.                  |

### Collection options

Configure these centrally under `collections` or on a collection under `custom.redirect`.

| Option    | Behavior                                                                                      |
| --------- | --------------------------------------------------------------------------------------------- |
| `path`    | One site-relative template shared by all locales.                                             |
| `paths`   | One site-relative template for every Payload locale. Requires localization.                   |
| `getPath` | Synchronous callback returning a complete path or `null`; locale prefixes are not applied.    |
| `enabled` | Defaults to enabled when a strategy is set. Set `false` alone to disable automatic redirects. |

Choose exactly one of `path`, `paths`, or `getPath`. `enabled: false` cannot be combined with a path strategy. Templates must start with `/`, cannot include query strings or fragments, and use top-level field names in brackets.

### Redirect rules

Each rule has a globally unique normalized `from` path and a normalized site-relative `to` path. `statusCode` defaults to `"301"` and may be `"302"`; the exported `RedirectStatusCode` type is numeric. `enabled` defaults to `true`; `origin` is `"manual"` or `"auto"`. Rules have no locale or hostname scope.

### Access control

Reads are public by default. Manual writes require an authenticated non-service user when access checks run. Automatic writes use internal context, so custom create/update access must allow them.

### Public types

The package exports `redirects`, `RedirectsOptions`, `RedirectCollectionOptions<TSlug>`, `RedirectOrigin` (`"manual" | "auto"`), and `RedirectStatusCode` (`301 | 302`).

## Compatibility

| Requirement                  | Support and limits                                                                                                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                      | `^22.23.5`, `^24.22.3`, or `>=26.13.1`.                                                                                                                                                                         |
| Payload                      | `>=3.94.1 <4`.                                                                                                                                                                                                  |
| PostgreSQL                   | Optional `@payloadcms/db-postgres` peer, `>=3.94.1 <4`; graph writes require an active Payload transaction at `READ COMMITTED`.                                                                                 |
| Other database adapters      | No equivalent concurrency guarantee is claimed; atomic graph validation is not verified.                                                                                                                        |
| Automatic redirects          | Require `versions.drafts` on each configured collection.                                                                                                                                                        |
| Content localization         | Uses Payload locale configuration and resolves each locale without fallback.                                                                                                                                    |
| Localized publication status | Opt-in requires both `experimental.localizeStatus: true` and `versions.drafts.localizeStatus: true`. Payload marks it experimental; this package has basic, not comprehensive, per-locale publication coverage. |
| Admin translations           | Payload Admin i18n is separate; plugin labels and validation messages are not translated by the package.                                                                                                        |
| Frontend framework           | Framework-independent rule storage.                                                                                                                                                                             |

## Documentation

- [Failure semantics](./docs/FAILURE_SEMANTICS.md)
- [Payload content localization](https://payloadcms.com/docs/configuration/localization)
- [Payload localized publication status](https://payloadcms.com/docs/configuration/localization#status-localization)
- [Payload Admin i18n](https://payloadcms.com/docs/configuration/i18n)
- [Payload drafts and versions](https://payloadcms.com/docs/versions/drafts)
- [Payload Local API](https://payloadcms.com/docs/local-api/overview)

## License

[MIT](./LICENSE)
