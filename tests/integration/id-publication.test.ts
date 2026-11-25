import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { createRedirect } from '@klnap/payload-redirect'
import {
  createRedirectIntPayload,
  draftVersions,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from '../helpers/payload-harness'

describe.skipIf(!intDatabaseConfigured)('id identifier', () => {
  let handle: RedirectIntHandle

  beforeAll(async () => {
    handle = await createRedirectIntPayload({
      collections: [
        {
          slug: 'items',
          versions: draftVersions,
          fields: [{ name: 'title', type: 'text' }],
          hooks: { afterChange: [createRedirect({ identifier: 'id' })] },
        },
      ],
    })
  }, 120_000)

  afterAll(async () => {
    await handle.destroy()
  })

  it('stable document id does not create redirects on update', async () => {
    await handle.resetRedirects()
    const doc = await handle.payload.create({
      collection: 'items',
      data: { title: 'One', _status: 'published' },
    })
    await handle.payload.update({
      collection: 'items',
      id: doc.id,
      data: { title: 'Two' },
      draft: true,
    })
    await handle.payload.update({
      collection: 'items',
      id: doc.id,
      data: { _status: 'published' },
    })

    const redirects = await handle.payload.find({ collection: 'redirects', overrideAccess: true })
    expect(redirects.totalDocs).toBe(0)
  })
})
