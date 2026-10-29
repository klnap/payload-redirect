# ADR-0001: Test layout

## Status

Accepted

## Context

`@klnap/payload-redirect` keeps the redirect feature under `src/core/redirects/` with Postgres integration tests for plugin flows.

## Decision

| Directory | Role | Script |
| :--- | :--- | :--- |
| `tests/unit/` | Units under `tests/unit/core/redirects/` by boundary (no DB) | `test:unit` |
| `tests/architecture/` | dependency-cruiser gate | `test:arch` |
| `tests/security/` | Behavioral security cases (Postgres) | `test:security` |
| `tests/integration/` | End-to-end plugin flows (Postgres) | `test:int` |

Postgres suites require `PAYLOAD_REDIRECT_TEST_DATABASE_URL` (isolated DB per file).

## Consequences

- `bun run test` runs all tiers sequentially.
- GitHub `ci.yml` sets `PAYLOAD_REDIRECT_TEST_DATABASE_URL` against the workflow Postgres service.
- `check:boundaries` is also invoked from `tests/architecture/boundaries.test.ts`.
