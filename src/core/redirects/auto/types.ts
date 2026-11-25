import type { CollectionSlug, DataFromCollectionSlug, TypedLocale } from 'payload'

export type RedirectPathOptions<TSlug extends CollectionSlug = CollectionSlug> =
  | {
      enabled?: true
      path: string
      paths?: never
      getPath?: never
    }
  | {
      enabled?: true
      path?: never
      paths: string extends Extract<TypedLocale, string>
        ? Record<string, string>
        : Record<Extract<TypedLocale, string>, string>
      getPath?: never
    }
  | {
      enabled?: true
      path?: never
      paths?: never
      getPath: (args: {
        doc: DataFromCollectionSlug<TSlug>
        locale: TypedLocale | undefined
      }) => string | null
    }
  | {
      enabled: false
      path?: never
      paths?: never
      getPath?: never
    }

export type PublicationTransition = {
  locale?: string
  currentDoc: Record<string, unknown>
  publishedDocs: Record<string, unknown>[]
}
