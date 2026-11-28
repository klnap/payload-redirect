export default {
  containerName: "payload-redirect-test-db",
  label: "payload-redirect.ephemeral-postgres",
  envVar: "PAYLOAD_REDIRECT_TEST_DATABASE_URL",
  // Same pinned image as .github/workflows/ci.yml, so local and CI integration tests share one server version.
  image:
    "postgres:16-alpine@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea",
  cleanupDelayMs: 750,
};
