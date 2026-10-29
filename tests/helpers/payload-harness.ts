import { randomBytes } from 'node:crypto'
import { redirects } from '@klnap/payload-redirect'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { BasePayload, buildConfig, type CollectionConfig, type Payload } from 'payload'
import {
  createIsolatedDatabase,
  intDatabaseConfigured,
  resolveTestDatabaseUrl,
} from './pg-container'

// Drizzle pushDevSchema skips when rawTables match a prior in-process init (new DB still empty).
process.env.PAYLOAD_FORCE_DRIZZLE_PUSH = 'true'

const PAYLOAD_SECRET = 'payload-redirect-int-secret-32chars!!'

let harnessInitLock: Promise<void> = Promise.resolve()

export type RedirectIntHandle = {
  payload: Payload
  /** Isolated Postgres URL (integration tests / schema checks). */
  connectionString: string
  destroy: () => Promise<void>
  resetRedirects: () => Promise<void>
  resetArticles: () => Promise<void>
}

export type HarnessOptions = {
  collections?: CollectionConfig[]
  pluginCollection?: CollectionConfig
  localePrefix?: Record<string, string>
  localization?: {
    locales: string[]
    defaultLocale: string
    fallback?: boolean
  }
}

export const draftVersions = {
  drafts: {
    autosave: false,
    localizeStatus: false,
  },
}

export const localizedDraftVersions = {
  drafts: {
    autosave: false,
    localizeStatus: true,
  },
}

export const withPublishAllQuery = {
  query: { publishAllLocales: 'true' as const },
}

export const withDraftQuery = {
  query: { draft: 'true' as const },
}

async function wipeCollection(payload: Payload, slug: string) {
  let page = 1
  for (;;) {
    const existing = await payload.find({
      collection: slug,
      limit: 500,
      page,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs.length === 0) break
    for (const doc of existing.docs) {
      await payload.delete({ collection: slug, id: doc.id, overrideAccess: true })
    }
    if (!existing.hasNextPage) break
    page += 1
  }
}

export async function createRedirectIntPayload(
  options: HarnessOptions = {}
): Promise<RedirectIntHandle> {
  const resolvedBaseUrl = resolveTestDatabaseUrl()
  if (!resolvedBaseUrl) {
    throw new Error('PAYLOAD_REDIRECT_TEST_DATABASE_URL required for integration tests')
  }
  const baseUrl: string = resolvedBaseUrl

  const prior = harnessInitLock
  let releaseLock!: () => void
  harnessInitLock = new Promise<void>((resolve) => {
    releaseLock = resolve
  })
  await prior

  try {
    const isolated = await createIsolatedDatabase(baseUrl)
    const connectionString = isolated.url

    const redirectsSlug = options.pluginCollection?.slug ?? 'redirects'
    const usesLocalizedStatus = options.collections?.some((c) => {
      const versions = c.versions
      if (!versions || typeof versions !== 'object' || !('drafts' in versions)) return false
      const drafts = versions.drafts
      return typeof drafts === 'object' && drafts !== null && drafts.localizeStatus === true
    })

    const config = await buildConfig({
      secret: `${PAYLOAD_SECRET}-${randomBytes(8).toString('hex')}`,
      editor: lexicalEditor(),
      serverURL: `http://redirect-int-${randomBytes(4).toString('hex')}.test`,
      localization: options.localization,
      ...(usesLocalizedStatus ? { experimental: { localizeStatus: true } } : {}),
      collections: options.collections ?? [],
      globals: [],
      db: postgresAdapter({
        idType: 'uuid',
        pool: { connectionString },
        push: true,
      }),
      plugins: [
        redirects({
          collection: options.pluginCollection ?? { slug: 'redirects', fields: [] },
          localePrefix: options.localePrefix,
        }),
      ],
    })

    const payload = new BasePayload()
    await payload.init({ config })

    async function resetRedirects() {
      await wipeCollection(payload, redirectsSlug)
    }

    async function resetArticles() {
      for (const slug of ['articles', 'items', 'fail-publish']) {
        if (payload.collections[slug]) {
          await wipeCollection(payload, slug)
        }
      }
    }

    async function destroy() {
      if (payload.db.destroy) {
        await payload.db.destroy()
      }
    }

    await resetRedirects()

    return { payload, connectionString, destroy, resetRedirects, resetArticles }
  } finally {
    releaseLock()
  }
}

export { intDatabaseConfigured }
