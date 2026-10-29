# Manual verification matrix (`@klnap/payload-redirect`)

Manual E2E checklist for the redirects plugin in **any** Payload host: `{REDIRECTS}` collection, manual rules, optional auto `301` on published slug change, REST access, and `resolveRedirect`.

## Related specs

| Topic | Spec |
| :--- | :--- |
| Usage & hooks | [../README.md](../README.md) |
| Package layout | [package-layout.md](./package-layout.md) |
| DB indexes | [docs/adr/0002-database-indexes.md](../docs/adr/0002-database-indexes.md) |

## Assumptions

- Host registers `redirects()` (optionally `localePrefix`, `access`, `collection`, `trash`).
- For auto rules: at least one collection with drafts and `afterChange: [createRedirect({ identifier: 'slug' })]`, plus published path templates the hook can resolve (see README).
- REST base `{API}`; redirect collection slug `{REDIRECTS}` (default `redirects`).
- Default access: public **read**, authenticated **create/update/delete** unless the host overrides.

## Case legend

| Field | Meaning |
| :--- | :--- |
| **Trigger** | Admin UI action or HTTP request |
| **Preconditions** | DB state, actor, locale |
| **Expected** | UI, HTTP, DB, optional `resolveRedirect` |
| **Failure** | Must not happen |

For numbered scenarios (`R-x.y.z`), **per-locale publish matrix (§7)**, pre-flight checks, and the summary sheet, use [manual-verification-matrix-complete.md](./manual-verification-matrix-complete.md).
