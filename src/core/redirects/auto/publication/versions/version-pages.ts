import type { CollectionSlug, PayloadRequest, TypedLocale } from "payload";
import { isPublishedVersionRow, type VersionRow } from "./version-rows.js";

export const fetchPublishedVersionPages = async ({
  req,
  collectionSlug,
  docId,
  locale,
  versionFilter,
}: {
  req: PayloadRequest;
  collectionSlug: string;
  docId: string | number;
  locale?: string;
  versionFilter?: { localizeStatus?: boolean; defaultLocale?: string };
}): Promise<VersionRow[]> => {
  const published: VersionRow[] = [];
  let page = 1;
  const limit = 50;

  while (true) {
    const result = await req.payload.findVersions({
      collection: collectionSlug as CollectionSlug,
      where: { parent: { equals: docId } },
      sort: "-updatedAt",
      depth: 0,
      page,
      limit,
      ...(locale ? { locale: locale as TypedLocale } : {}),
      fallbackLocale: false,
      overrideAccess: true,
      req,
    });

    published.push(
      ...(result.docs as VersionRow[]).filter((row) =>
        isPublishedVersionRow(row, locale, versionFilter),
      ),
    );

    if (!result.hasNextPage) break;
    page += 1;
  }

  return published;
};
