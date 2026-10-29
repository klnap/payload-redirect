# Failure semantics — `@klnap/payload-redirect`

This document describes **observable** failures: thrown errors, validation messages, and resolver behavior. It reflects the current implementation and tests, not future guarantees.

## Thrown errors (public classes)

### `RedirectConfigError`

**When:** Plugin configuration or host redirects collection is invalid at startup (via `resolveRedirectsPluginConfig` / `assertValidCollectionConfig`).

**Examples:**

- `redirects plugin requires collection — register a redirects CollectionConfig...`
- `redirects collection field "from" must have unique: true`
- `redirects collection field "StatusCode" must be type number, got "..."`

**Recovery:** Fix `payload.config` collection definition or plugin options.

### `RedirectValidationError`

**When:** Path or status/destination rules are violated (normalization, field validators).

**Examples:**

- `from/to must be a non-empty path or URL`
- `Invalid absolute URL: ...`
- `StatusCode must be one of 301, 302` (via `assertRedirectStatusCode`)
- `StatusCode 301 requires a non-empty "to" field`

**Recovery:** Correct admin input or API payload.

### `RedirectAmbiguousRuleError`

**When:** `resolveRedirect` finds **more than one** document for the same normalized `from` with the resolve select (enabled rules should be unique by DB constraint).

**Message shape:** `Multiple redirect rules exist for "<path>" (unique constraint should prevent this)`

**Recovery:** Data repair—dedupe `from` in the redirects collection.

### Runtime: plugin not registered

**When:** `getRedirectRuntime` is called without `redirects()` having registered runtime on `config.custom`.

**Message:** `payload-redirect: plugin runtime missing — add redirects() to payload config`

## Collection validation (admin / API)

| Check | User-visible result |
|-------|---------------------|
| Duplicate normalized `from` | Payload `ValidationError`: *A redirect rule already exists for this source path* |
| Invalid `from` / `to` path | Field validation message from `RedirectValidationError` text |
| `StatusCode` not 301 or 302 | *StatusCode must be 301 or 302* |
| Invalid `origin` | *origin must be manual or auto* |
| `301`/`302` without `to` | Destination validation error on `to` |

`from` is normalized in the duplicate guard before comparison.

## `resolveRedirect` behavior

| Condition | Result |
|-----------|--------|
| No document for normalized `from` | `null` |
| Document exists, `enabled: false` | `null` |
| Document exists, enabled, valid 301/302 with `to` | `{ statusCode, to }` |
| Document exists but status not 301/302 (legacy data) | `null` (assertion fails inside mapping) |
| Multiple documents same `from` | `RedirectAmbiguousRuleError` |

`overrideAccess: false` on lookup—respects collection read access.

## Auto redirect persistence (`ensureAutoRedirect`)

| Situation | Outcome |
|-----------|---------|
| No existing rule for `from` | Creates rule (`origin: auto`, `301`, enabled) |
| Existing **Auto** rule, same `from`/`to`/301/enabled | `skipped` |
| Existing **Auto** rule, different `to` | Updates `to` (and normalizes 301/enabled) |
| Existing **Manual** rule on same `from` | `skipped` (no overwrite) |

Internal writes set `payloadRedirectInternal` and `payloadRedirectSkipAuto` on context.

## Publication transition (no redirect)

Auto hook returns early (no pairs) when implementation detects:

- No drafts on collection
- Draft save
- `payloadRedirectSkipAuto`
- Unpublished document (per `publish-intent` / status helpers)
- No locale to evaluate (depends on request and localized draft status)
- No identifier change for locale
- Empty/disallowed paths after build/normalize

Exact branches are covered by `tests/security/*` and `tests/integration/*`.

## Configuration vs runtime

| Layer | Failure mode |
|-------|----------------|
| Plugin init | `RedirectConfigError` — process fails to build config |
| Save redirect | Field validation or duplicate `ValidationError` |
| Resolve | `null`, thrown ambiguous error, or Payload access error from `find` |

This package does **not** define HTTP status codes for “no redirect”; the host returns `null` resolution as “continue normal routing.”
