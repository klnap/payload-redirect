import type { CollectionConfig, PayloadRequest, TypedLocale } from 'payload'

export const toTypedLocale = (locale: string): TypedLocale => locale as TypedLocale

export const fetchLocalePublishedDoc = async ({
  req,
  collection,
  docId,
  locale,
  draft = false,
}: {
  req: PayloadRequest
  collection: CollectionConfig
  docId: string | number
  locale: string
  draft?: boolean
}): Promise<Record<string, unknown> | undefined> => {
  try {
    return (await req.payload.findByID({
      collection: collection.slug,
      id: docId,
      locale: toTypedLocale(locale),
      fallbackLocale: false,
      depth: 0,
      draft,
      overrideAccess: true,
      req,
    })) as unknown as Record<string, unknown>
  } catch {
    return undefined
  }
}
