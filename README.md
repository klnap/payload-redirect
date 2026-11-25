# @klnap/payload-redirect

Payload plugin for manual and publication-generated redirects.

## Install

```sh
npm install @klnap/payload-redirect
```

Requires Payload `>=3.94.1 <4`. PostgreSQL is the supported adapter for transaction-safe
duplicate and redirect-chain checks.

## Configure

```ts
import { buildConfig } from 'payload'
import { redirects } from '@klnap/payload-redirect'

export default buildConfig({
  collections: [
    {
      slug: 'articles',
      versions: { drafts: true },
      fields: [{ name: 'slug', type: 'text', required: true }],
      custom: {
        redirect: {
          identifier: 'slug',
          publishedLink: { path: '/articles/[slug]' },
        },
      },
    },
  ],
  plugins: [
    redirects({
      localePrefix: { en: '', pl: '/pl' },
    }),
  ],
})
```

`redirects()` adds the plugin-owned `redirects` collection and wires publication hooks for
collections with `custom.redirect.identifier`. It preserves existing hooks. Do not register a
second redirects collection or add manual publication hooks.

The plugin creates a rule when a published identifier changes. Draft saves, first publications,
unpublishes, and unchanged identifiers do not create rules. A manual rule on the same source path
always wins over an automatic rule.

## Published paths

Put collection-specific settings in `custom.redirect.publishedLink`. `custom.draft.publishedLink`
is also read when `custom.redirect.publishedLink` is absent.

Use `path` for a shared template, `paths` for locale-specific templates, or `getPath` for custom
logic. Template parameters match top-level collection fields; localized fields resolve for the
published locale. Dynamic values are URL-encoded as single path segments.

```ts
custom: {
  redirect: {
    identifier: 'slug',
    publishedLink: {
      paths: {
        en: '/articles/[slug]',
        pl: '/artykuly/[slug]',
      },
    },
  },
}
```

`getPath` receives the published document snapshot and locale. Return a site path or `null` to skip
that transition:

```ts
publishedLink: {
  getPath: ({ doc, locale }) =>
    `/articles/${String(doc.category)}/${String(doc.slug)}-${locale}`,
}
```

Centralized path rules can be set in `redirects()`; collection `publishedLink` settings take precedence:

```ts
redirects({
  localePrefix: { en: '', pl: '/pl' },
  collections: {
    articles: {
      identifier: 'slug',
      path: '/articles/[slug]',
    },
  },
})
```

Payload localization defines the available locales. If you set a prefix map, include every locale.
An empty prefix means no locale segment. Without a prefix map, the builder uses the locale code.

## Redirect collection

The plugin owns the collection and its required fields: `from`, `to`, `StatusCode`, `enabled`, and
`origin`. `from` is unique. Redirect writes normalize paths and reject duplicate sources and
enabled loops. Manual rules are not overwritten by publication hooks.

Pass native Payload collection settings through `overrides`:

```ts
redirects({
  overrides: {
    slug: 'url-rules',
    labels: { singular: 'URL rule', plural: 'URL rules' },
    admin: { group: 'Content' },
  },
})
```

Use `overrides.fields` to customize the plugin fields. It receives `defaultFields`; required fields,
validators, uniqueness, and indexes remain enforced.

`enabled: false` disables automatic generation only. The manual redirects collection remains
available.

## Checks and limits

- PostgreSQL is required for transaction-scoped advisory locking and race-safe graph validation.
- Other database adapters are not claimed to provide equivalent concurrency guarantees.
- The plugin stores redirect rules; the host application serves them from its routing layer.
- The package does not expose a redirect resolver or HTTP middleware.

Run package checks:

```sh
bun run typecheck
bun run typecheck:consumer
bun test src tests/unit
bun run test:int
bun run check:release
```
