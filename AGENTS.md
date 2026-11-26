# `@klnap/payload-redirect` — maintainer rules

Public usage: [README.md](./README.md). Failure semantics: [docs/FAILURE_SEMANTICS.md](./docs/FAILURE_SEMANTICS.md).

- Contract: `RedirectOrigin` is `manual` or `auto`. `RedirectStatusCode` is `301` or `302`.
- Automatic paths use `path`, `paths`, or `getPath` in central `collections` options or `custom.redirect`.
- Central configuration replaces collection-level configuration. `localePrefixes` applies only to templates.
- Automatic generation compares complete published paths with Payload fallback disabled.
- The plugin owns the redirects collection; manual redirects need no automatic configuration.

Layout: `src/core/redirects/` (feature), `src/core/url/` (path templates), `src/plugin/`, `src/exports/` (`.`).

## Development and release policy

The maintainer has standing authorization to complete package development and release work without repeated approval. This covers task branches, implementation, verification, Conventional Commits, pushes, pull requests, eligible workflow approvals, squash merges, Changesets, generated Release PRs, npm Trusted Publishing through GitHub Actions, release verification, branch synchronization, and cleanup.

Use GitHub Flow: start from current `origin/main`, reuse active branches and PRs, keep task branches short-lived, and squash-merge verified PRs. Preserve unrelated user changes. Keep repository protections; never force-push or reset indiscriminately.

For completed implementation work that warrants a release, complete the lifecycle: inspect existing work and pending Changesets; implement, test, review, validate, document, and add a SemVer-appropriate Changeset; commit, push, and open or update a PR; pass required checks; merge; monitor main CI and Changesets; review the generated Release PR's full scope, version, and changelog; approve eligible workflow runs; pass release checks; merge; monitor artifact verification and npm Trusted Publishing; independently verify the npm version, dist-tag, provenance when supported, Git tag, and GitHub Release; sync local `main` and safely clean up branches.

Changesets is the sole version and release mechanism. Never bump versions or create tags manually, publish from a local machine, or add long-lived npm publishing tokens. Preserve build-once, verify, then publish. Inspect pending Changesets before release and do not release infrastructure-only changes without a consumer-facing change. Use `~/code/packages/npm-package-template` as the source for shared engineering and release infrastructure.

Explicit task limits such as local-only, push-only, no merge, no release, or no publication override this default for that task. Research, investigation, design discussions, and unfinished implementations do not trigger releases.

Stop only for genuine blockers: missing permissions or interactive authentication, unresolved security issues or failing required checks, conflicting user changes, unexpected release scope, architectural decisions needing maintainer input, or platform restrictions that require bypassing security. Do not stop for routine approvals or required PR steps when authorized; do not repeat successful checks or refactor without need.
