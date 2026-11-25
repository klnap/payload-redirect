# Releasing

The first staged release uses package version `0.1.0`. npm creates the public
`0.0.0-stage` placeholder when the first package is staged; the package contents
stay private until a maintainer approves the staged release with 2FA.

## One-time setup

1. Create the public GitHub repository `klnap/payload-redirect` and push `main`.
2. From the package root, run `npm stage publish` while logged in to npm. This
   bootstraps the package entry and stages the `0.1.0` contents.
3. Configure the npm trusted publisher:
   - Provider: GitHub Actions
   - Organization/user: `klnap`
   - Repository: `payload-redirect`
   - Workflow filename: `release.yml`
   - Environment: `npm`
   - Allow `npm publish`; do not enable dist-tag changes.
4. Create the GitHub environment named `npm`.

The release workflow needs no npm token. npm grants it short-lived OIDC
publishing access and generates provenance. Stage approval remains a separate
maintainer action and requires 2FA.

## Publish the initial release

Review and approve the staged `0.1.0` package on npmjs.com or with
`npm stage approve <stage-id>`. npm exposes a `0.0.0-stage` placeholder while
the package is staged. After approval, push the matching release tag:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The workflow validates the tagged package and skips publishing if `0.1.0` is
already on npm. Later versions are validated and published by the same OIDC
workflow.

For later releases, update `package.json`, validate the change, and push a matching
`v<version>` tag from `main`.
