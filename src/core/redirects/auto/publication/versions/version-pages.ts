import type { PayloadRequest } from 'payload'
import { toTypedLocale } from './document-locale'
import { isPublishedVersionRow, type VersionRow } from './version-rows'

export const fetchPublishedVersionPages = async ({
  req,
  collectionSlug,
  docId,
  locale,
  versionLocale,
  versionFilter,
}: {
  req: PayloadRequest
  collectionSlug: string
  docId: string | number
  locale: string
  versionLocale?: string
  versionFilter?: { localizeStatus?: boolean; defaultLocale?: string; identifier?: string }
}): Promise<VersionRow[]> => {
  const published: VersionRow[] = []
  let page = 1
  const limit = 50
  const queryLocale = versionLocale ?? locale

  while (true) {
    const result = await req.payload.findVersions({
      collection: collectionSlug,
      where: { parent: { equals: docId } },
      sort: '-updatedAt',
      depth: 0,
      page,
      limit,
      ...(versionLocale === undefined ? {} : { locale: toTypedLocale(queryLocale) }),
      overrideAccess: true,
      req,
    })

    const rows = (result.docs as unknown as VersionRow[]).filter((row) =>
      isPublishedVersionRow(row, locale, versionFilter)
    )
    published.push(...rows)

    if (!result.hasNextPage) break
    page += 1
  }

  return published
}

export const fetchVersionHistoryPages = async ({
  req,
  collectionSlug,
  docId,
  versionLocale,
}: {
  req: PayloadRequest
  collectionSlug: string
  docId: string | number
  versionLocale?: string
}): Promise<VersionRow[]> => {
  const rows: VersionRow[] = []
  let page = 1
  const limit = 50

  while (true) {
    const result = await req.payload.findVersions({
      collection: collectionSlug,
      where: { parent: { equals: docId } },
      sort: '-updatedAt',
      depth: 0,
      page,
      limit,
      ...(versionLocale === undefined ? {} : { locale: toTypedLocale(versionLocale) }),
      overrideAccess: true,
      req,
    })

    const docs = (result.docs as unknown as VersionRow[]).filter(
      (row) => !row.snapshot && !row.autosave
    )
    rows.push(...docs)

    if (!result.hasNextPage) break
    page += 1
  }

  return rows
}
