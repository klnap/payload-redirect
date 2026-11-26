# Contributing

Development requires Bun `1.4.5` and Node.js `^22.23.5 || ^24.22.3 || >=26.13.1`.
`packageManager` in `package.json` is the source of the Bun version used in GitHub Actions.
TypeScript skips dependency declaration checks because Payload `3.94.1` has declaration conflicts
under TypeScript `7.0.2`; package consumer fixtures still typecheck the public API.

Use short-lived branches and open a pull request against `main`. The repository uses squash merges.

Use Conventional Commits for pull request titles, such as `fix: handle empty input` or
`feat!: change the public API`. Keep commits understandable; local Git hooks are not required.

Add a changeset when a change affects a package consumer:

```sh
bun run changeset
```

Choose `patch` for compatible fixes and additions, `minor` for breaking changes while the package is
below `1.0.0`, and `major` for breaking changes from `1.0.0` onward. This pre-1.0 policy is an
explicit project convention; SemVer itself treats pre-1.0 APIs as unstable.

Documentation-only, test-only, and internal maintenance changes do not need a changeset unless they
change distributed files or consumer behavior.

Before opening a pull request, run:

```sh
bun install --frozen-lockfile
bun run check
bun run test:int
```

`bun run test:int` starts an isolated PostgreSQL instance for integration and security tests.
`renovate.json` pins workflow action digests and delays new dependencies for three days. The
Renovate GitHub App must be installed for its update policy to run.
