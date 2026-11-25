# `@klnap/payload-redirect` — maintainer rules

Public usage: [README.md](./README.md). Failure semantics: [docs/FAILURE_SEMANTICS.md](./docs/FAILURE_SEMANTICS.md).

- Contract: `RedirectOrigin` is `manual` or `auto`. `RedirectStatusCode` is `301` or `302`.
- Automatic paths use `path`, `paths`, or `getPath` in central `collections` options or `custom.redirect`.
- Central configuration replaces collection-level configuration. `localePrefixes` applies only to templates.
- Automatic generation compares complete published paths with Payload fallback disabled.
- The plugin owns the redirects collection; manual redirects need no automatic configuration.

Layout: `src/core/redirects/` (feature), `src/core/url/` (path templates), `src/plugin/`, `src/exports/` (`.`).
