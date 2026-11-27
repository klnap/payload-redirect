# Failure semantics — `@klnap/payload-redirect`

This document records observable configuration, validation, and publication behavior.

## Plugin configuration

| Condition                                                  | Result                                                                                          |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `redirects()` is not registered                            | Payload config has no redirects collection or automatic publication hooks.                      |
| The redirects collection slug already exists               | Plugin config throws and names the colliding slug.                                              |
| `redirects()` is registered more than once                 | Plugin config throws; register it once.                                                         |
| `overrides.fields` changes a required field type           | Plugin config throws before Payload builds. Missing required fields are restored from defaults. |
| A Collection or Global has no redirect configuration       | The entity is left unchanged; no publication hook is added.                                     |
| Central options name an unregistered Collection or Global  | Plugin configuration throws and names the entity.                                               |
| A configured Collection or Global has no `versions.drafts` | Plugin configuration throws and names the entity.                                               |
| Path config has unsupported options or multiple strategies | Plugin configuration throws before Payload builds.                                              |
| Locale map omits or adds a Payload locale                  | Plugin configuration throws and names invalid locales.                                          |
| Automatic generation is disabled                           | No automatic hook is added; manual rules remain available.                                      |
| A Global defines `custom.redirect`                         | The plugin appends its Global publication hook and preserves existing hooks.                    |

## Redirect collection writes

`from` and `to` must be non-empty site-relative paths. The plugin normalizes them before checking
duplicates and loops.

Collection and field authorization use Payload's native defaults and consumer overrides. Trusted
automatic redirect operations use Local API `overrideAccess: true`; their request-context marker
tracks rule origin and recursion only. Ordinary REST, GraphQL, and user-scoped Local API operations
remain subject to their configured access rules.

| Condition                                           | Result                                                         |
| --------------------------------------------------- | -------------------------------------------------------------- |
| Duplicate normalized `from`                         | Payload validation error on `from`.                            |
| Enabled redirect chain loops or exceeds 1,000 hops  | Payload validation error on `to`.                              |
| `statusCode` is not `301` or `302`                  | Payload field validation error.                                |
| `to` is missing or invalid                          | Payload field validation error.                                |
| `origin` is invalid                                 | Payload field validation error.                                |
| A manual rule already owns an automatic source path | Automatic write is skipped; the manual rule remains unchanged. |

Internal writes carry server-side request context and run inside the Payload transaction. PostgreSQL
uses a transaction-scoped advisory lock to serialize graph checks. Other adapters do not claim the
same concurrent-write guarantee.

## Published paths

Automatic rules use one of `path`, `paths`, or `getPath`, configured centrally or in
`custom.redirect`. Central configuration replaces local configuration.

| Condition                                                   | Result                                                                        |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| No matching path configuration                              | Automatic generation is not registered for that Collection or Global.         |
| Template value is missing or unsafe                         | That locale's publication transition is skipped.                              |
| `getPath` returns `null` or a non-site-relative path        | That locale's transition is skipped.                                          |
| `getPath` returns a non-string value                        | That locale's transition is skipped.                                          |
| Locale is absent                                            | A shared `path` works without a prefix map; localized `paths` cannot resolve. |
| Locale is missing from a configured prefix map              | Plugin configuration fails before Payload builds.                             |
| Generated source and destination normalize to the same path | No redirect is written.                                                       |

Draft saves, first publications, unpublishes, and deletions create no automatic rules. Existing
redirects remain when a document is unpublished or deleted.

On an unchanged republish, an enabled identical automatic rule is left alone. A missing rule is
recreated, and a disabled automatic rule is re-enabled, when an earlier published version resolves
to a different path. The source is the latest earlier published path that differs from the current
path.

An automatic write skips a source path owned by a manual rule. Editing an automatic rule changes
its origin to `manual`, so later publications do not update it. A path-template change does not
migrate historical rules.

If a generated rule would close a loop, validation rejects the redirect write and the publication
fails. The collection has one globally unique `from` field and no locale or hostname scope; two
localized routes cannot own the same source path with different destinations.

## Adapter boundary

PostgreSQL is the supported adapter for atomic graph validation and writes. SQLite, MongoDB, and
other adapters may provide Payload transactions, but this package does not assume their locking
semantics match PostgreSQL advisory locks.
