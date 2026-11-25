import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from '../helpers/payload-harness'

describe.skipIf(!intDatabaseConfigured)('concurrent duplicate from', () => {
  let handle: RedirectIntHandle

  beforeAll(async () => {
    handle = await createRedirectIntPayload()
  }, 120_000)

  afterAll(async () => {
    await handle.destroy()
  })

  it('allows only one enabled rule per from under concurrent create', async () => {
    await handle.resetRedirects()

    const results = await Promise.allSettled([
      handle.payload.create({
        collection: 'redirects',
        data: { from: '/race', to: '/a', StatusCode: 301, enabled: true },
        overrideAccess: true,
      }),
      handle.payload.create({
        collection: 'redirects',
        data: { from: '/race', to: '/b', StatusCode: 301, enabled: true },
        overrideAccess: true,
      }),
    ])

    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')
    expect(fulfilled.length).toBe(1)
    expect(rejected.length).toBe(1)

    const active = await handle.payload.find({
      collection: 'redirects',
      where: { and: [{ from: { equals: '/race' } }, { enabled: { equals: true } }] },
      overrideAccess: true,
    })
    expect(active.totalDocs).toBe(1)
  })
})
