# ADR-0002: Redirects collection indexes and queries

## Status

Accepted

## Context

Hooks look up by normalized `from`. At most one row per `from` is a domain invariant.

## Schema (Payload field flags)

| Field | Flags | Role |
| :--- | :--- | :--- |
| `from` | `unique: true` | Point lookups; duplicate guard (Postgres unique btree via Payload) |
| `enabled` | `index: true` | Filters on active rules |

Collection defaults: `versions: false`, `defaultSort: 'from'`, `timestamps: true`.

The plugin owns this collection and enforces compatible `from` / `enabled` flags.

## Postgres (optional index)

Partial index for active rules:

```sql
CREATE INDEX IF NOT EXISTS "redirects_enabled_from_active_idx"
ON "redirects" USING btree ("from")
WHERE "enabled" = true AND "deleted_at" IS NULL;
```

See host database performance docs when adding indexes for large redirect tables.

## Query patterns (package)

| Path | DB round-trips | Notes |
| :--- | :--- | :--- |
| `ensureAutoRedirect` | 1 or 2 | Single `find` by `from`; create if absent |
| Duplicate guard | 1 per save | `beforeChange`; `id not_equals` on update |
| Redirect-chain guard | 1 per hop | `beforeChange`; bounded at 1,000 hops |

## Non-goals

- Composite `(enabled, from)` btree without partial predicate — redundant with unique `from` for point lookups
