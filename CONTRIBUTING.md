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

Test commands:

- `bun run test`: unit tests in `src` and `tests/unit`. No database or Docker needed.
- `bun run test:int`: integration and security tests against PostgreSQL. Needs a running Docker daemon, or
  an existing disposable PostgreSQL URL in `PAYLOAD_REDIRECT_TEST_DATABASE_URL`. If neither exists, the command
  exits with status 1 and says so. It never reports a skipped integration run as a pass.
- `bun run check`: formatting, lint, dependency boundaries, types, unit tests, build, consumer types, package
  validation, and export checks. It does not run `test:int`.

Without `PAYLOAD_REDIRECT_TEST_DATABASE_URL`, `bun run test:int` starts `postgres:16-alpine`, pinned to the
same digest as CI, in a container with a random host port on `127.0.0.1` and a random password. Each test file
creates its own `redirect_int_*` database and drops it afterward. The container is removed when the command ends,
including after a failed test or Ctrl+C. Other containers, networks, and volumes are not touched.

CI runs the same suite against its PostgreSQL service container through `PAYLOAD_REDIRECT_TEST_DATABASE_URL`. To
reuse another disposable server, set that variable to a URL on a loopback host, or on a host with a `test`,
`testing`, `disposable`, or `integration` label (delimited by dots or hyphens). Production-looking hosts are
refused, and so are `host` and `hostaddr` query parameters, which would override the checked hostname.
If only the wrapper process is terminated with SIGTERM while tests run, the child keeps running until it exits;
then the container is removed.
`renovate.json` pins workflow action digests and delays new dependencies for three days. The
Renovate GitHub App must be installed for its update policy to run.
