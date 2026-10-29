import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { versionedArticlesCollection } from '../helpers/factories/versioned-document'
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from '../helpers/payload-harness'

describe.skipIf(!intDatabaseConfigured)('delete document', () => {
  let handle: RedirectIntHandle

  beforeAll(async () => {
    handle = await createRedirectIntPayload({
      collections: [versionedArticlesCollection()],
    })
  })

  afterAll(async () => {
    await handle.destroy()
  })

  it('does not create auto redirect on delete', async () => {
    await handle.resetRedirects()
    const created = await handle.payload.create({
      collection: 'articles',
      data: { slug: '/old', title: 'A', _status: 'published' },
    })

    await handle.payload.delete({ collection: 'articles', id: created.id, overrideAccess: true })

    const redirects = await handle.payload.find({ collection: 'redirects', overrideAccess: true })
    expect(redirects.totalDocs).toBe(0)
  })
})
