# Releasing

This repository uses Changesets and npm Trusted Publishing. Do not publish manually or create
release tags by hand.

## Release lifecycle

1. Add a changeset for a consumer-visible change with `bun run changeset`.
2. Merge the pull request to `main` after the `verify` status check passes.
3. The Release workflow opens or updates a Release PR with the package version and changelog.
4. Review and merge the Release PR.
5. The workflow builds, packs, and verifies the tarball before publishing that artifact to npm.
6. The workflow creates the matching `vX.Y.Z` tag and GitHub Release.

The version job uses its job-scoped `GITHUB_TOKEN`. GitHub may hold workflows triggered by its
Release PR for maintainer approval; approve those runs without bypassing required checks.

Use patch for compatible changes and minor for breaking changes while the package remains below
`1.0.0`. Internal, test-only, or documentation-only changes need no changeset unless they alter
published files or behavior.

## One-time external configuration

- Configure the GitHub `npm` environment to allow deployments from `main`. Do not add environment
  reviewers.
- Allow GitHub Actions to create and approve pull requests. Keep default workflow token permissions
  read-only, allow full-SHA-pinned actions, and require SHA pinning.
- Protect `main` with a squash-only pull-request ruleset, required `verify` status check, linear
  history, and deletion/non-fast-forward restrictions.
- Protect `v*` tags from updates and deletion, and enable immutable releases.
- Enable the dependency graph, vulnerability alerts, secret scanning, push protection, and private
  vulnerability reporting.
- Install the Renovate GitHub App if automated dependency updates are wanted.
- Bind npm Trusted Publishing to GitHub owner `klnap`, repository `payload-redirect`, workflow
  `release.yml`, and environment `npm`. Do not configure an npm token.
- Verify an existing publisher before changing it:

  ```sh
  npm trust list @klnap/payload-redirect
  ```

npm Trusted Publishing requires npm CLI `11.5.1+` and Node.js `22.14.0+`. The workflow pins npm
`12.2.3` and runs on Node.js 24. npm creates provenance automatically for trusted publications.
After verifying the first OIDC publication, enable “Require two-factor authentication and disallow
tokens” in npm publishing access settings.

Never replace an existing Trusted Publisher or weaken repository protections without explicit
maintainer approval. Repository and npm settings are external to this source tree.
