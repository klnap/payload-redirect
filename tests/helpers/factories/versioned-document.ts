import type { CollectionConfig } from 'payload'
import { draftVersions, localizedDraftVersions } from '../payload-harness'

export const versionedArticlesCollection = (
  localized = false,
  options?: { slugRequired?: boolean }
): CollectionConfig => ({
  slug: 'articles',
  versions: localized ? localizedDraftVersions : draftVersions,
  fields: [
    {
      name: 'slug',
      type: 'text',
      required: options?.slugRequired !== false,
      unique: false,
      ...(localized ? { localized: true } : {}),
    },
    { name: 'title', type: 'text' },
  ],
  custom: {
    redirect: { identifier: 'slug' },
  },
})
