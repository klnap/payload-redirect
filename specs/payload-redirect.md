# Payload redirects (`@klnap/payload-redirect`)

## Contract

- `redirects()` registers the plugin-owned redirects collection.
- Manual redirect management does not require automatic-generation configuration.
- Automatic generation is opt-in per collection through central `collections` options or
  `custom.redirect`.
- Each configured collection uses exactly one of `path`, `paths`, or `getPath`.
- Central configuration replaces, rather than merges with, collection-level configuration.
- `localePrefixes` applies to template-based paths. `getPath` returns a complete path.
- Payload localization and published versions provide snapshots; fallback locales are disabled.
- The public package API contains `redirects()`, `RedirectCollectionOptions`, and `RedirectsOptions`.
- The host application serves redirect rules through its own routing layer.

## Redirect collection

- Required fields: `from`, `to`, `statusCode`, `enabled`, and `origin`.
- `from` is unique and normalized before duplicate checks.
- `statusCode` accepts `301` or `302`.
- Automatic writes run inside the Payload request transaction.
- PostgreSQL advisory locks serialize duplicate and redirect-chain checks.
- Other adapters are not claimed to provide equivalent concurrency guarantees.

## Publication behavior

- Draft saves, first publications, unpublishes, deletions, and unchanged complete paths create no rule.
- A changed complete published path creates an automatic `301` rule from the previous path to the
  current path.
- Localized templates resolve each locale independently without fallback values.
- Missing or unsafe paths skip that locale's transition.
- `getPath` receives the locale-specific published snapshot and locale.

## Verification

```sh
bun install --frozen-lockfile
bun run check
bun run test:int
```
