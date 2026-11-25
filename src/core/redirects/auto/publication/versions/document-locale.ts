import type { CollectionConfig, CollectionSlug, PayloadRequest, TypedLocale } from 'payload'

export const fetchLocalePublishedDoc = async ({
  req,
  collection,
  docId,
  locale,
}: {
  req: PayloadRequest
  collection: CollectionConfig
  docId: string | number
  locale?: string
}): Promise<Record<string, unknown>> =>
  (await req.payload.findByID({
    collection: collection.slug as CollectionSlug,
    id: docId,
    ...(locale ? { locale: locale as TypedLocale } : {}),
    fallbackLocale: false,
    depth: 0,
    overrideAccess: true,
    req,
  })) as Record<string, unknown>
