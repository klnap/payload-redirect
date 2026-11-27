---
"@klnap/payload-redirect": minor
---

Use Payload's native access defaults for the redirects collection. Trusted automatic redirect
operations now bypass collection access explicitly; public reads require an access override.
Add automatic redirect support for versioned Globals, including localized publication and restore
transitions, through independent `globals` options or Global `custom.redirect`.
