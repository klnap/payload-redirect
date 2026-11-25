# Releasing

This repository uses the tag-triggered GitHub Actions workflow in
`.github/workflows/release.yml`. No Changesets configuration is present.

1. Update `package.json` and `CHANGELOG.md` on a pull-request branch.
2. Merge the pull request to `main` after required checks pass.
3. Push the matching `v<version>` tag from the merged commit.
4. Wait for release validation and publication to complete.
5. Create the GitHub release for that tag with the changelog entry.

The workflow verifies that the tag matches `package.json` and points to a commit on `main`. It
publishes the validated tarball through npm Trusted Publishing with OIDC and provenance. The npm
environment must retain its required maintainer approval.
