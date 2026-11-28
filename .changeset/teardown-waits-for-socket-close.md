---
"@klnap/payload-redirect": patch
---

Test infrastructure only: the integration pool teardown waits for pg-pool to close each client socket before the test database is dropped. No runtime change.
