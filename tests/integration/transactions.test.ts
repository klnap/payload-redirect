import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { createRedirect } from '@klnap/payload-redirect'
import {
  createRedirectIntPayload,
  draftVersions,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from '../helpers/payload-harness'

describe.skipIf(!intDatabaseConfigured)('transactions', () => {
  let handle: RedirectIntHandle

  beforeAll(async () => {
    handle = await createRedirectIntPayload({
      collections: [
        {
          slug: 'fail-publish',
          versions: draftVersions,
          fields: [{ name: 'slug', type: 'text', required: true }],
          hooks: {
            afterChange: [
              createRedirect({ identifier: 'slug' }),
              async (args) => {
                if (args.operation !== 'update') return args.doc
                if (args.doc?._status !== 'published') return args.doc
                throw new Error('simulated failure after redirect hook')
              },
            ],
          },
        },
      ],
    })
  }, 120_000)

  afterAll(async () => {
    await handle.destroy()
  })

  it('does not persist redirect when publication hook chain fails', async () => {
    await handle.resetRedirects()
    const created = await handle.payload.create({
      collection: 'fail-publish',
      data: { slug: '/a', _status: 'published' },
    })

    await expect(
      handle.payload.update({
        collection: 'fail-publish',
        id: created.id,
        data: { slug: '/b' },
        draft: true,
      })
    ).resolves.toBeDefined()

    await expect(
      handle.payload.update({
        collection: 'fail-publish',
        id: created.id,
        data: { _status: 'published' },
      })
    ).rejects.toThrow()

    const redirects = await handle.payload.find({ collection: 'redirects', overrideAccess: true })
    expect(redirects.totalDocs).toBe(0)
  })
})
