# `@klnap/payload-redirect`

Redirect management for Payload CMS.

## Quick start

Register the plugin once in `payload.config.ts`:

```ts
import { redirects } from "@klnap/payload-redirect";
import { buildConfig } from "payload";

export default buildConfig({
  // ...your database, editor, and collections
  plugins: [
    redirects({
      collections: {
        articles: { path: "/articles/[slug]" },
      },
    }),
  ],
});
```

Publish an article, then change its slug and publish again:

```text
/articles/hello-world
→ /articles/introduction-to-payload (301)
```

The plugin stores the rule. Your application looks it up and sends the response; see [Application integration](#application-integration). Draft edits alone create no rule.

## Why?

Published URLs change when editors update content. A changed slug breaks links from search results, social posts, and other sites. Moved pages and campaign links need redirects too, and maintaining each one by hand is easy to forget.

This plugin records the change automatically when a published path moves. It also gives editors a place in the Payload Admin to manage redirects for moved pages and campaign links.

## Features

- Automatic `301` rules when a published path changes, including changes to other fields in the path, such as a category.
- Configuration next to the schema with `custom.redirect`, or centrally in `redirects()`.
- Collections and Globals with the same rules.
- Native Payload localization with one template per locale, or one shared template with locale prefixes.
- Manual `301` and `302` rules, enabled or disabled, with query strings and fragments.
- Duplicate sources and loops are rejected. Manual rules are never overwritten by automatic ones.
- No runtime dependencies beyond the Payload peer.

## Installation

```bash
bun add @klnap/payload-redirect
```

```bash
npm install @klnap/payload-redirect
```

`payload` is a required peer dependency. `@payloadcms/db-postgres` is an optional peer dependency; install it when you use PostgreSQL. Node.js versions are listed in [Compatibility](#compatibility-and-documentation).

## Usage

### Automatic redirects

Add `custom.redirect` to any Collection with drafts enabled:

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
  ],
  custom: {
    redirect: {
      path: "/articles/[slug]",
    } satisfies RedirectCollectionOptions<"articles">,
  },
};
```

Register the plugin without options:

```ts
plugins: [redirects()],
```

Central configuration does the same job. Use either pattern, not both. A central entry replaces the entity's `custom.redirect` for that entity.

```ts
redirects({
  collections: {
    articles: { path: "/articles/[slug]" },
  },
});
```

A route is one of three strategies:

| Option    | Use when                                                                              |
| --------- | ------------------------------------------------------------------------------------- |
| `path`    | The route is a template over top-level fields, such as `/articles/[slug]`.            |
| `paths`   | Each locale has its own template. See [Localization](#localization).                  |
| `getPath` | The route depends on logic a template cannot express. Return `null` to skip a locale. |

Prefer `path` and `paths`. Use `getPath` only when you need it:

```ts
custom: {
  redirect: {
    getPath: ({ doc }) => (doc.category === "interviews" ? `/interviews/${doc.slug}` : null),
  } satisfies RedirectCollectionOptions<"articles">,
},
```

Values in `getPath` are not encoded for you. Encode dynamic segments with `encodeURIComponent` when they can contain spaces or reserved characters.

A rule is created only when a publication changes the published path. Draft saves, unchanged republications, and unpublishing create nothing. Existing rules stay when a document is unpublished or deleted. A first publication creates nothing either, because there is no previous path.

Full-path tracking uses several fields. A category change then creates a redirect even when the slug stays the same:

```ts
path: "/articles/[category]/[slug]",
```

### Globals

Globals work the same way. Give the Global drafts and a `custom.redirect` entry. This About page is a familiar example:

```ts
// src/globals/About.ts
import type { GlobalConfig } from "payload";
import type { RedirectGlobalOptions } from "@klnap/payload-redirect";

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
```

Publishing a new slug `about-us` creates this redirect:

```text
/about → /about-us (301)
```

### Localization

The plugin uses Payload's native content localization. Configure locales in `buildConfig`, make the slug field localized, and give each locale its path in `paths`:

```ts
// payload.config.ts
export default buildConfig({
  localization: {
    locales: ["en", "fr", "de"],
    defaultLocale: "en",
  },
  // ...
  plugins: [
    redirects({
      localePrefixes: { en: "", fr: "/fr", de: "/de" },
    }),
  ],
});
```

```ts
// src/collections/Articles.ts
export const Articles: CollectionConfig = {
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
};
```

With these settings the same article has one path per locale:

| Locale | Slug              | Public path                  |
| ------ | ----------------- | ---------------------------- |
| `en`   | `getting-started` | `/articles/getting-started`  |
| `fr`   | `premiers-pas`    | `/fr/articles/premiers-pas`  |
| `de`   | `erste-schritte`  | `/de/artikel/erste-schritte` |

Changing the French slug to `bien-demarrer` and publishing creates only the French redirect:

```text
/fr/articles/premiers-pas
→ /fr/articles/bien-demarrer (301)
```

Rules for localized paths:

- `path` is one template for every locale. `paths` gives one template per locale and must list every locale in `localization.locales`.
- `localePrefixes` adds a prefix to `path` and `paths`. It must list every locale. Use `""` for the default locale.
- A locale without a slug is skipped. Generation never uses another locale's slug, even when Payload's fallback is enabled for reads.
- Redirect rules have no locale. Different locales need different source paths.
- Payload's experimental localized publication status (`localizeStatus`) is supported at the level described in [Compatibility](#compatibility-and-documentation).

For Globals, the same `localePrefixes` apply to the template. `/about` becomes `/fr/about` in French; use a localized slug field for the translated page name, such as `/fr/a-propos` and `/de/uber-uns`.

### Manual redirects

`redirects()` registers a Payload collection named `redirects`. Editors create and edit rules in the Payload Admin. Manual rules need no automatic configuration and no tracked Collection or Global.

| From           | To                                     | Status |
| -------------- | -------------------------------------- | ------ |
| `/old-page`    | `/new-page`                            | `301`  |
| `/old-guide`   | `/guides/getting-started#installation` | `301`  |
| `/summer-sale` | `/offers`                              | `302`  |

Use `301` for a permanent move. Use `302` for a temporary destination, such as a seasonal offer. Destinations may include a fragment. Sources may not.

### Campaign links

Share short, readable URLs in SMS campaigns, newsletters, or promotional materials. A manual rule sends visitors to the landing page with campaign parameters:

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| `from`       | `/summer-2027`                                                        |
| `to`         | `/summer-2027?utm_source=sms&utm_medium=sms&utm_campaign=summer_2027` |
| `statusCode` | `302`                                                                 |
| `enabled`    | `true`                                                                |

The public pathname stays the same. Only the destination carries the parameters.

Query strings follow these rules:

- Sources and destinations may contain a query string. Matching is exact: `/campaign?ref=sms` is different from `/campaign` and from `/campaign?ref=email`.
- A source and destination can share a pathname when their query strings differ. The application must include the query string in its lookup, shown in [Application integration](#application-integration). Otherwise the landing request matches the campaign rule again.
- Parameters are not merged, reordered, or forwarded. The destination is the stored `to`.
- Automatic routes have no query strings. Campaign rules are ordinary manual rules.

Editing or disabling an automatic rule in the Payload Admin turns it into a manual rule, and later publications no longer change it. A manual rule that already owns a source path is never overwritten by an automatic one.

The plugin stores these rules only. It does not collect attribution data or connect to analytics or advertising tools.

## Application integration

The plugin stores rules and never sends a response. Your application looks each request up and redirects. The example below is for Next.js 16 (`src/proxy.ts`); the same logic works in any framework that can call the Payload Local API.

```ts
// src/proxy.ts
import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import payloadConfig from "@payload-config";

function normalizeRequestPath(pathname: string): string {
  const collapsed = pathname.replace(/\/{2,}/g, "/");
  return collapsed.length > 1 && collapsed.endsWith("/") ? collapsed.slice(0, -1) : collapsed;
}

export async function proxy(request: NextRequest) {
  const { search } = request.nextUrl;
  const from = normalizeRequestPath(request.nextUrl.pathname) + search;

  const payload = await getPayload({ config: payloadConfig });
  const { docs } = await payload.find({
    collection: "redirects",
    where: {
      and: [{ from: { equals: from } }, { enabled: { equals: true } }],
    },
    limit: 1,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });

  const rule = docs[0];
  if (!rule) return NextResponse.next();

  // Never redirect a request to the URL it already has.
  const target = new URL(rule.to, request.url);
  if (target.pathname + target.search === from) return NextResponse.next();

  return NextResponse.redirect(target, Number(rule.statusCode) as 301 | 302);
}

export const config = {
  matcher: ["/((?!api|admin|_next/static|_next/image|favicon.ico).*)"],
};
```

`@payload-config` is the alias that the Payload Next.js template sets up. It points to your `payload.config.ts`. If you renamed the redirects collection with `overrides.slug`, use that slug here.

How the lookup matches:

- The lookup is exact. It joins the normalized pathname and the query string (`request.nextUrl.search`, which includes the leading `?`). `/campaign?ref=sms` matches only that query string.
- The path is not decoded. A browser always sends encoded characters, so store the encoded form of a path: a rule for `/café` must be stored as `/caf%C3%A9`.
- Trailing slashes and repeated slashes are normalized the same way the plugin stores paths, so `/articles/hello-world/` matches `/articles/hello-world`.
- Next.js may already redirect some URLs before `proxy.ts` runs, for example to add or remove a trailing slash.

A pathname-only rule does not match a request with extra query parameters. If you want generic pathname rules to apply to any query string, add a second lookup in your application after the exact one, and make sure the redirect cannot repeat. Keep the exact match first. The plugin does not provide this fallback.

## Configuration and access control

### Plugin options

| Option           | Default                             | Description                                                                               |
| ---------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `collections`    | None                                | Central configuration for Collections. Replaces the entity's `custom.redirect`.           |
| `globals`        | None                                | Central configuration for Globals. Replaces the entity's `custom.redirect`.               |
| `localePrefixes` | No prefixes                         | One prefix per locale, applied to `path` and `paths`. Must list every locale.             |
| `overrides`      | Plugin-owned `redirects` collection | Native Payload collection options, plus `fields` to add fields. Required fields are kept. |

### Overrides

`overrides` passes options to the plugin-owned collection. This example renames it and adds a note field:

```ts
redirects({
  overrides: {
    slug: "url-redirects",
    admin: { group: "Settings" },
    fields: ({ defaultFields }) => [...defaultFields, { name: "editorNote", type: "textarea" }],
  },
});
```

Then change `collection: "redirects"` to `collection: "url-redirects"` in your application lookup.

### Access control

The redirects collection uses Payload's native access defaults. Anyone who is not logged in cannot read or write rules.

Automatic generation runs inside the publication hook with trusted Local API calls (`overrideAccess: true`). Editors who publish content therefore create redirects without holding redirect permissions. REST, GraphQL, and user-scoped Local API calls follow your access rules.

Public read access is opt-in:

```ts
redirects({
  overrides: {
    access: {
      read: () => true,
    },
  },
});
```

Public reads return every field the rule allows, including disabled rules and editor notes. Use field-level `access` to hide fields you do not want public.

Your application's lookup in [Application integration](#application-integration) uses trusted server-side access and does not need public read access.

## Compatibility and documentation

| Requirement                  | Support                                                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                      | `^22.23.5`, `^24.22.3`, or `>=26.13.1`, as declared in `engines`.                                                                                                            |
| Payload                      | Declared peer range `>=3.94.1 <4`. The test suite runs against Payload `3.94.1`, the version in the development dependencies. Other 3.x versions are not tested.             |
| PostgreSQL                   | `@payloadcms/db-postgres` peer `>=3.94.1 <4`. The integration tests run against PostgreSQL 16. Redirect graph writes are serialized with a transaction-scoped advisory lock. |
| Other database adapters      | Not tested. No concurrency guarantee is claimed for them.                                                                                                                    |
| Localized publication status | Payload's experimental `localizeStatus`. The plugin follows the per-locale publication status Payload stores; see [Limitations](#limitations).                               |
| Application framework        | The rule store is framework-independent. The lookup example targets Next.js 16.                                                                                              |

### Limitations

- Route changes do not migrate old URLs. Add manual rules for paths you changed before the plugin was installed.
- Automatic rules follow the published history that Payload keeps. If retention removes the version that held the previous path, no rule is created for that change.
- Restoring an older version publishes it and creates a rule. The restore is rejected when that rule would close a loop with enabled rules.
- Changes to the route configuration are not compared with old content paths. Edit manual rules for those.
- Source paths are unique across all Collections and Globals, and rules have no locale, domain, or host scope.
- Loop detection covers enabled stored rules. It cannot see loops created by host routing, external redirects, or browser URL equivalence.
- Request matching, caching, and HTTP responses belong to your application. Lookups run on every matched request, so keep the matcher narrow.
- Localized publication status depends on Payload's experimental feature. This package's coverage of it is limited to the cases described in its tests.
- Fragments are not allowed on source paths. Destinations may include them.

### Documentation

- [Failure semantics](./docs/FAILURE_SEMANTICS.md): exact behavior for each configuration and write error.
- [Releasing](https://github.com/klnap/payload-redirect/blob/main/docs/RELEASING.md): release process for maintainers.
- [Contributing](https://github.com/klnap/payload-redirect/blob/main/CONTRIBUTING.md): development setup and checks.
- [Security policy](https://github.com/klnap/payload-redirect/blob/main/SECURITY.md): how to report vulnerabilities.
- [Payload content localization](https://payloadcms.com/docs/configuration/localization)
- [Payload drafts and versions](https://payloadcms.com/docs/versions/drafts)
- [Payload Local API](https://payloadcms.com/docs/local-api/overview)

## License

MIT. See [LICENSE](./LICENSE).
