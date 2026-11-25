import type { CollectionConfig, Field } from 'payload'
import { defaultRedirectAccess } from './access.js'
import { createDuplicateBeforeChange } from './duplicate-guard.js'
import { assertRedirectFields, buildRedirectFields, mergeRedirectFields } from './fields.js'
import { createRedirectOriginBeforeChange } from './origin-hook.js'
import type { RedirectCollectionOverrides } from './types.js'

const DEFAULT_SLUG = 'redirects'

export const createRedirectsCollection = (
  overrides: RedirectCollectionOverrides = {}
): CollectionConfig => {
  const defaultFields = buildRedirectFields()
  const fields: Field[] = overrides.fields
    ? mergeRedirectFields(overrides.fields({ defaultFields }))
    : defaultFields

  assertRedirectFields(fields)

  const slug = overrides.slug ?? DEFAULT_SLUG
  const existingHooks = overrides.hooks ?? {}
  const access = { ...defaultRedirectAccess, ...overrides.access }

  return {
    ...overrides,
    slug,
    trash: overrides.trash ?? true,
    versions: overrides.versions ?? false,
    timestamps: overrides.timestamps ?? true,
    admin: {
      useAsTitle: 'from',
      defaultColumns: ['from', 'to', 'StatusCode', 'origin', 'enabled', 'updatedAt'],
      listSearchableFields: ['from', 'to'],
      ...overrides.admin,
    },
    defaultSort: overrides.defaultSort ?? 'from',
    access,
    fields,
    hooks: {
      ...existingHooks,
      beforeChange: [
        ...(existingHooks.beforeChange ?? []),
        createRedirectOriginBeforeChange(),
        createDuplicateBeforeChange(slug),
      ],
    },
  }
}
