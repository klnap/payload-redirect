---
"@klnap/payload-redirect": patch
---

Fix automatic redirect ownership races. Automatic rule generation and rule updates now take the redirect graph lock before reading existing rules, so a manual edit committed during the decision is no longer overwritten. Graph validation now reads the stored rule after the lock is acquired. The README's Next.js example now matches the stored source exactly, including the query string, and no longer decodes the request path.
