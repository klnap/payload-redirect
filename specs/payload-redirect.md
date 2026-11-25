# Payload redirects (`@klnap/payload-redirect`)

## Contract

- `redirects()` adds and owns the redirects collection.
- The plugin wires publication hooks for collections configured with `custom.redirect.identifier`.
- `custom.redirect.publishedLink` or `custom.draft.publishedLink` defines public paths.
- Plugin-level collection and locale defaults can be overridden by collection configuration.
- Manual rules are not overwritten by automatic publication rules.
- The public package API contains `redirects()` and its options type only.
- The host application serves redirect rules through its own routing layer.

## Redirect collection

- Required fields: `from`, `to`, `StatusCode`, `enabled`, and `origin`.
- `from` is unique and normalized before duplicate checks.
- `StatusCode` accepts `301` or `302`.
- Automatic writes run inside the Payload request transaction.
- PostgreSQL advisory locks serialize duplicate and redirect-chain checks.
- Other adapters are not claimed to provide equivalent concurrency guarantees.

## Publication behavior

- Draft saves, first publications, unpublishes, deletions, and unchanged identifiers create no rule.
- A changed published identifier creates an automatic `301` rule from the previous path to the current path.
- Locale-aware templates resolve each transition independently.
- Missing or unsafe template values skip that transition.
- `getPath` receives previous/current published snapshots and the locale.

## Verification

```sh
bun run typecheck
bun test src tests/unit
bun run test:int
bun run check:boundaries
bun run check:release
```
