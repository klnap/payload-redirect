import type { CollectionConfig, Field } from 'payload'

export type RedirectCollectionOverrides = Omit<CollectionConfig, 'fields' | 'slug'> & {
  fields?: (args: { defaultFields: Field[] }) => Field[]
  slug?: string
}
