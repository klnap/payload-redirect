# Failure semantics — `@klnap/payload-redirect`

This document records observable configuration, validation, and publication behavior.

## Plugin configuration

| Condition | Result |
|---|---|
| `redirects()` is not registered | Payload config has no redirects collection or automatic publication hooks. |
| The redirects collection slug already exists | Plugin config throws and names the colliding slug. |
| `redirects()` is registered more than once | Plugin config throws; register it once. |
| `overrides.fields` changes a required field type | Plugin config throws before Payload builds. Missing required fields are restored from defaults. |
| `custom.redirect` has no identifier | The collection is left unchanged; no publication hook is added. |
| Automatic generation is disabled | No automatic hook is added; manual rules remain available. |

## Redirect collection writes

`from` and `to` must be non-empty site-relative paths. The plugin normalizes them before checking
duplicates and loops.

| Condition | Result |
|---|---|
| Duplicate normalized `from` | Payload validation error on `from`. |
| Enabled redirect chain loops or exceeds 1,000 hops | Payload validation error on `to`. |
| `StatusCode` is not `301` or `302` | Payload field validation error. |
| `to` is missing or invalid | Payload field validation error. |
| `origin` is invalid | Payload field validation error. |
| A manual rule already owns an automatic source path | Automatic write is skipped; the manual rule remains unchanged. |

Internal writes carry server-side request context and run inside the Payload transaction. PostgreSQL
uses a transaction-scoped advisory lock to serialize graph checks. Other adapters do not claim the
same concurrent-write guarantee.

## Published paths

Automatic rules use `custom.redirect.publishedLink`, falling back to `custom.draft.publishedLink`.
Plugin-level path defaults apply when the collection does not override them.

| Condition | Result |
|---|---|
| No matching path configuration | The normalized identifier value is used as the path. |
| Template value is missing or unsafe | That publication transition is skipped. |
| `getPath` returns `null` | That publication transition is skipped. |
| `getPath` returns a non-string value other than `null` | Path building throws. |
| Locale is absent | The normalized identifier value is used as the path. |
| Locale is missing from a configured prefix map | That publication transition is skipped. |
| Generated source and destination normalize to the same path | No redirect is written. |

Draft saves, first publications, unpublishes, deletions, and unchanged identifiers do not create
automatic rules.

## Adapter boundary

PostgreSQL is the supported adapter for atomic graph validation and writes. SQLite, MongoDB, and
other adapters may provide Payload transactions, but this package does not assume their locking
semantics match PostgreSQL advisory locks.
