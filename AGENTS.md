# `@klnap/payload-redirect` (maintainers)

**User guide:** [README.md](./README.md) · [docs/FAILURE_SEMANTICS.md](./docs/FAILURE_SEMANTICS.md)

Payload redirects: `301`/`302`, Manual / Auto origins, `resolveRedirect`. Auto published paths use `src/core/url/` and `readPublishedLinkWire` on collection `custom`.

**Contract:** `RedirectOrigin` = `manual` | `auto`; `RedirectStatusCode` = `301` | `302`.

## Layout

- `src/core/redirects/` — feature implementation
- `src/core/url/` — published path templates (`buildPublishedPath`, route params)
- `src/plugin/` — `redirects()` only (no consumer wiring)
- `src/exports/` — `.` entry only

Auto path resolution: `readPublishedLinkWire` (`custom.redirect.publishedLink`, optional `custom.draft.publishedLink`), `resolvePublishedPathConfig`, `buildPublishedPath` under `#redirect/core/url/*`.

## Public exports

`.` — plugin, hooks, resolver, errors, types, `REDIRECT_CONTEXT_KEYS`

## Commands

```bash
bun run test:unit
bun run check:boundaries
bun run check:exports
```
