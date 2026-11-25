# Failure semantics — `@klnap/payload-redirect`

This document records observable configuration, validation, and publication behavior.

## Plugin configuration

| Condition | Result |
|---|---|
| `redirects()` is not registered | Payload config has no redirects collection or automatic publication hooks. |
| The redirects collection slug already exists | Plugin config throws and names the colliding slug. |
| `redirects()` is registered more than once | Plugin config throws; register it once. |
| `overrides.fields` changes a required field type | Plugin config throws before Payload builds. Missing required fields are restored from defaults. |
| A collection has no redirect configuration | The collection is left unchanged; no publication hook is added. |
| Central collection options name an unregistered collection | Plugin configuration throws and names the collection. |
| A configured collection has no `versions.drafts` | Plugin configuration throws and names the collection. |
| Path config has unsupported options or multiple strategies | Plugin configuration throws before Payload builds. |
| Locale map omits or adds a Payload locale | Plugin configuration throws and names invalid locales. |
| Automatic generation is disabled | No automatic hook is added; manual rules remain available. |

## Redirect collection writes

`from` and `to` must be non-empty site-relative paths. The plugin normalizes them before checking
duplicates and loops.

| Condition | Result |
|---|---|
| Duplicate normalized `from` | Payload validation error on `from`. |
| Enabled redirect chain loops or exceeds 1,000 hops | Payload validation error on `to`. |
| `statusCode` is not `301` or `302` | Payload field validation error. |
| `to` is missing or invalid | Payload field validation error. |
| `origin` is invalid | Payload field validation error. |
| A manual rule already owns an automatic source path | Automatic write is skipped; the manual rule remains unchanged. |

Internal writes carry server-side request context and run inside the Payload transaction. PostgreSQL
uses a transaction-scoped advisory lock to serialize graph checks. Other adapters do not claim the
same concurrent-write guarantee.

## Published paths

Automatic rules use one of `path`, `paths`, or `getPath`, configured centrally or in
`custom.redirect`. Central configuration replaces local configuration.

| Condition | Result |
|---|---|
| No matching path configuration | Automatic generation is not registered for that collection. |
| Template value is missing or unsafe | That locale's publication transition is skipped. |
| `getPath` returns `null` or a non-site-relative path | That locale's transition is skipped. |
| `getPath` returns a non-string value | That locale's transition is skipped. |
| Locale is absent | A shared `path` works without a prefix map; localized `paths` cannot resolve. |
| Locale is missing from a configured prefix map | Plugin configuration fails before Payload builds. |
| Generated source and destination normalize to the same path | No redirect is written. |

Draft saves, first publications, unpublishes, deletions, and unchanged complete paths do not create
automatic rules.

## Adapter boundary

PostgreSQL is the supported adapter for atomic graph validation and writes. SQLite, MongoDB, and
other adapters may provide Payload transactions, but this package does not assume their locking
semantics match PostgreSQL advisory locks.
