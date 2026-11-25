# Payload redirects (`@klnap/payload-redirect`)

## 1. Problem Statement

CMS editors need durable URL redirect rules and automatic `301` rules when published slugs change, without coupling to Next.js or the public frontend.

## 2. Solution Overview

Payload plugin merges redirect fields/hooks into a **host-owned** `redirects` collection (`redirects({ collection })` required), optional `createRedirect` hook for auto rules on publish, and `resolveRedirect` for runtime lookup. Publication edge cases (drafts, locales, `localizeStatus`) are handled in-package.

- **User guide:** [packages/payload-redirect/README.md](../README.md)
- **Maintainers:** [packages/payload-redirect/AGENTS.md](../AGENTS.md)

## 3. Scope

**In scope:**

- Manual rules: `301` / `302`, unique normalized `from`
- Auto `301` on published identifier change — opt in with `custom.redirect: { identifier: 'slug' }` on content collections (or manual `createRedirect` hook)
- `RedirectOrigin`: `manual` (default) | `auto`
- Postgres: the package bundles no migrations and does not wrap the adapter; schema changes use Payload migrate or push in the host.
- Integration with `@klnap/draft` published path templates
- Postgres-backed integration and security tests in the package

**Out of scope:**

- Redirect chains, edge middleware, CDN cache invalidation, HTTP framework integration
- Automatic rules on document delete
- A locale column on redirect documents

## 4. Acceptance Criteria

1. Exactly one enabled rule per normalized `from` at resolve time; duplicates rejected on save.
2. Draft saves and unpublished documents do not create automatic redirects.
3. `resolveRedirect` returns `null` for disabled rules; throws on ambiguous enabled duplicates.
4. `bun run check:boundaries` and package `test` pass in CI (GitHub Actions provides Postgres via `PAYLOAD_REDIRECT_TEST_DATABASE_URL`).
5. Frontends consume redirect rules via Payload REST on `redirects`; `from` is unique+indexed, `enabled` is indexed for bulk filters.

## 5. Validation Commands

See the repository command reference (`docs/development.md`). Package:

```bash
bunx turbo run test --filter=@klnap/payload-redirect
bunx turbo run check:boundaries --filter=@klnap/payload-redirect
```

Integration tests require `PAYLOAD_REDIRECT_TEST_DATABASE_URL` (see package README).
