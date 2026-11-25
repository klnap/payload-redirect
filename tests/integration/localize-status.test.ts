import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { createRedirect } from '@klnap/payload-redirect'
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  localizedDraftVersions,
  type RedirectIntHandle,
} from '../helpers/payload-harness'

describe.skipIf(!intDatabaseConfigured)('localizeStatus', () => {
  let handle: RedirectIntHandle

  beforeAll(async () => {
    handle = await createRedirectIntPayload({
      localization: { locales: ['pl', 'en', 'de'], defaultLocale: 'pl', fallback: true },
      collections: [
        {
          slug: 'pages',
          versions: localizedDraftVersions,
          fields: [{ name: 'slug', type: 'text', required: true, localized: true }],
          hooks: { afterChange: [createRedirect({ identifier: 'slug' })] },
        },
      ],
    })
  }, 120_000)

  afterAll(async () => {
    await handle.destroy()
  })

  it('only locales with prior publication history create redirects', async () => {
    await handle.resetRedirects()

    const created = await handle.payload.create({
      collection: 'pages',
      data: { slug: '/a' },
      locale: 'pl',
      draft: true,
    })

    await handle.payload.update({
      collection: 'pages',
      id: created.id,
      data: { _status: 'published' },
      locale: 'pl',
    })

    await handle.payload.update({
      collection: 'pages',
      id: created.id,
      data: { slug: '/b' },
      locale: 'pl',
      draft: true,
    })

    await handle.payload.update({
      collection: 'pages',
      id: created.id,
      data: { _status: 'published' },
      locale: 'pl',
    })

    const redirects = await handle.payload.find({ collection: 'redirects', overrideAccess: true })
    expect(redirects.totalDocs).toBe(1)
    expect(redirects.docs[0]?.from).toBe('/a')
    expect(redirects.docs[0]?.to).toBe('/b')
  })
})
