# `@klnap/payload-redirect` — maintainer rules

Public usage: [README.md](./README.md). Failure semantics: [docs/FAILURE_SEMANTICS.md](./docs/FAILURE_SEMANTICS.md).

- Contract: `RedirectOrigin` is `manual` or `auto`. `RedirectStatusCode` is `301` or `302`.
- Auto published paths come from `custom.redirect.publishedLink` (or `custom.draft.publishedLink`). Read them through `readPublishedLinkWire`. Build paths with `buildPublishedPath` in `src/core/url/`.
- `src/plugin/` contains only `redirects()`. Consumer wiring is not part of the package.

Layout: `src/core/redirects/` (feature), `src/core/url/` (path templates), `src/plugin/`, `src/exports/` (`.`).
