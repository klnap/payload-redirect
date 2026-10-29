# Package layout (tier 2)

## Layers

| Area | Responsibility |
| :--- | :--- |
| `core/redirects` | Collection, resolve, Auto redirects, Payload persistence |
| `plugin` | Plugin registration and config validation only |
| `exports` | Public API (`.` only) |

Auto published paths: `custom.redirect.publishedLink` (or `custom.draft.publishedLink`), `src/core/url/published-path.ts`.

Scope stops at `ResolvedRedirect | null` and Payload APIs.

## Non-goals

- Redirect chains
- HTTP framework integration (Next.js, middleware, edge caches)
- Auto rules on document delete
- Locale column on redirect documents

## Plugin config

- `collection` (required)
- `localePrefix`, `trash`, `access` (optional)

See [README.md](../README.md).
