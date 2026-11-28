---
"@klnap/payload-redirect": patch
---

Test infrastructure only: integration tests fail instead of skipping when PostgreSQL is unavailable, and the test database harness removes its container on success, failure, and interruption. No runtime change.
