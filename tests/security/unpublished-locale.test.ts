import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { createRedirect } from '@klnap/payload-redirect'
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  localizedDraftVersions,
  type RedirectIntHandle,
} from '../helpers/payload-harness'

describe.skipIf(!intDatabaseConfigured)('unpublished locale', () => {
  let handle: RedirectIntHandle

  beforeAll(async () => {
    handle = await createRedirectIntPayload({
      localization: { locales: ['pl', 'en'], defaultLocale: 'pl', fallback: true },
      collections: [
        {
          slug: 'posts',
          versions: localizedDraftVersions,
          fields: [{ name: 'slug', type: 'text', required: true, localized: true }],
          hooks: { afterChange: [createRedirect({ identifier: 'slug' })] },
        },
      ],
    })
  })

  afterAll(async () => {
    await handle.destroy()
  })

  it('first publish in en without pl history does not use pl fallback', async () => {
    await handle.resetRedirects()

    const created = await handle.payload.create({
      collection: 'posts',
      data: { slug: '/pl-old' },
      locale: 'pl',
      draft: true,
    })

    await handle.payload.update({
      collection: 'posts',
      id: created.id,
      data: { _status: 'published' },
      locale: 'pl',
    })

    await handle.payload.update({
      collection: 'posts',
      id: created.id,
      data: { slug: '/en-new' },
      locale: 'en',
      draft: true,
    })

    await handle.payload.update({
      collection: 'posts',
      id: created.id,
      data: { _status: 'published' },
      locale: 'en',
    })

    const redirects = await handle.payload.find({ collection: 'redirects', overrideAccess: true })
    expect(redirects.totalDocs).toBe(0)
  })
})
