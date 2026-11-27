---
"@klnap/payload-redirect": patch
---

Fix automatic redirects for republished documents and Local API publishing. Republishing a path that has not changed no longer recreates a rule an editor deleted. Publishing one locale or all locales through the Local API links each locale whose path changed. Global publications follow the same rules. The README is rewritten and its TypeScript examples are checked against the package types.
