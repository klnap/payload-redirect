# Changelog

## 0.4.4

### Patch Changes

- 2c92fa0: Document that the README Next.js proxy example is verified against PostgreSQL by the integration suite. No runtime change.

## 0.4.3

### Patch Changes

- 507492f: Test infrastructure only: integration tests fail instead of skipping when PostgreSQL is unavailable, and the test database harness removes its container on success, failure, and interruption. No runtime change.

## 0.4.2

### Patch Changes

- 3dc1473: Fix automatic redirects for republished documents and Local API publishing. Republishing a path that has not changed no longer recreates a rule an editor deleted. Publishing one locale or all locales through the Local API links each locale whose path changed. Global publications follow the same rules. The README is rewritten and its TypeScript examples are checked against the package types.

## 0.4.1

### Patch Changes

- 4adb5e9: Fix automatic redirect ownership races. Automatic rule generation and rule updates now take the redirect graph lock before reading existing rules, so a manual edit committed during the decision is no longer overwritten. Graph validation now reads the stored rule after the lock is acquired. The README's Next.js example now matches the stored source exactly, including the query string, and no longer decodes the request path.

## 0.4.0

### Minor Changes

- 1c388cd: Use Payload's native access defaults for the redirects collection. Trusted automatic redirect
  operations now bypass collection access explicitly; public reads require an access override.
  Add automatic redirect support for versioned Globals, including localized publication and restore
  transitions, through independent `globals` options or Global `custom.redirect`.

### Patch Changes

- 049c070: Rewrite the README with complete configuration examples, the custom.redirect reference, and serving redirects in Next.js.

## 0.3.1

### Patch Changes

- 41b4bce: Include the tested Node.js 22.23.5 range in package support metadata.

## 0.3.0

- Simplify automatic redirect configuration to `path`, `paths`, and `getPath`.
- Compare complete published paths with native Payload localization and no locale fallback.
- Register the redirects collection automatically and use `statusCode` as its status field.
