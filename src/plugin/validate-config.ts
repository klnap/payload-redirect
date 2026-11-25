import type { CollectionConfig, Field } from 'payload'
import { RedirectConfigError } from '#redirect/core/redirects/model/errors'

const isFieldWithName = (field: Field): field is Field & { name: string } =>
  'name' in field && typeof field.name === 'string'

const findField = (fields: Field[], name: string): Field | undefined =>
  fields.find((f) => isFieldWithName(f) && f.name === name)

export const validateRedirectsCollectionConfig = (collection: CollectionConfig): void => {
  if (!collection.slug || typeof collection.slug !== 'string') {
    throw new RedirectConfigError('redirects collection must have a valid slug')
  }

  const fields = collection.fields ?? []

  const expectedTypes = {
    from: 'text',
    to: 'text',
    StatusCode: 'select',
    enabled: 'checkbox',
    origin: 'select',
  } as const
  for (const [name, type] of Object.entries(expectedTypes)) {
    const field = findField(fields, name)
    if (field && (!('type' in field) || field.type !== type)) {
      throw new RedirectConfigError(
        `redirects collection field "${name}" must be type ${type}, got "${field.type}"`
      )
    }
  }

  const fromField = findField(fields, 'from')
  if (fromField) {
    if (!('unique' in fromField) || fromField.unique !== true) {
      throw new RedirectConfigError('redirects collection field "from" must have unique: true')
    }
  }

  const enabledField = findField(fields, 'enabled')
  if (enabledField && (!('index' in enabledField) || enabledField.index !== true)) {
    throw new RedirectConfigError('redirects collection field "enabled" must have index: true')
  }
}

export const assertValidCollectionConfig = (collection: unknown): CollectionConfig => {
  if (!collection || typeof collection !== 'object') {
    throw new RedirectConfigError('collection must be a CollectionConfig object')
  }
  const cfg = collection as CollectionConfig
  validateRedirectsCollectionConfig(cfg)
  return cfg
}
