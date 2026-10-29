export default {
  containerName: 'payload-redirect-test-db',
  hostPort: 5434,
  envVar: 'PAYLOAD_REDIRECT_TEST_DATABASE_URL',
  image: 'postgres:16-alpine',
  password: 'postgres',
}
