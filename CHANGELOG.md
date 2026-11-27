# Changelog

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
