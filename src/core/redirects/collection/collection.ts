import type { CollectionConfig } from 'payload'
import {
  mergeRedirectsAccess,
  type RedirectsCollectionAccess,
  redirectCreateAccess,
  redirectDeleteAccess,
  redirectReadAccess,
  redirectUpdateAccess,
} from './access'
import { createDuplicateBeforeChange } from './duplicate-guard'
import { buildRedirectFields, mergeRedirectFields } from './fields'
import { createRedirectOriginBeforeChange } from './origin-hook'

const DEFAULT_SLUG = 'redirects'

export type CreateRedirectsCollectionOptions = {
  base?: CollectionConfig
  /** Soft-delete (trash). Default true; set false to disable. Base collection `trash` wins when set. */
  trash?: boolean
  /** Plugin-level access overrides (applied when base collection omits a handler). */
  access?: RedirectsCollectionAccess
}

export const createRedirectsCollection = (
  options: CreateRedirectsCollectionOptions
): CollectionConfig => {
  const base = options.base
  const slug = base?.slug ?? DEFAULT_SLUG
  const fields = base?.fields ? mergeRedirectFields(base.fields) : buildRedirectFields()

  const existingHooks = base?.hooks ?? {}
  const trash = base?.trash ?? options.trash ?? true

  const access = mergeRedirectsAccess(
    base?.access as RedirectsCollectionAccess | undefined,
    options.access
  )

  return {
    ...base,
    slug,
    trash,
    versions: base?.versions ?? false,
    timestamps: base?.timestamps ?? true,
    admin: {
      useAsTitle: 'from',
      defaultColumns: ['from', 'to', 'StatusCode', 'origin', 'enabled', 'updatedAt'],
      listSearchableFields: ['from', 'to'],
      ...base?.admin,
    },
    defaultSort: 'from',
    access: {
      read: access.read ?? redirectReadAccess,
      create: access.create ?? redirectCreateAccess,
      update: access.update ?? redirectUpdateAccess,
      delete: access.delete ?? redirectDeleteAccess,
    },
    fields,
    hooks: {
      ...existingHooks,
      beforeChange: [
        ...(existingHooks.beforeChange ?? []),
        createRedirectOriginBeforeChange(),
        createDuplicateBeforeChange(),
      ],
    },
  }
}

export type { RedirectsCollectionAccess } from './access'
