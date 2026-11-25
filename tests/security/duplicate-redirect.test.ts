import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from '../helpers/payload-harness'

describe.skipIf(!intDatabaseConfigured)('duplicate active from', () => {
  let handle: RedirectIntHandle

  beforeAll(async () => {
    handle = await createRedirectIntPayload()
  })

  afterAll(async () => {
    await handle.destroy()
  })

  it('rejects second enabled rule with same from', async () => {
    await handle.resetRedirects()
    await handle.payload.create({
      collection: 'redirects',
      data: { from: '/dup', to: '/a', StatusCode: 301, enabled: true },
      overrideAccess: true,
    })

    await expect(
      handle.payload.create({
        collection: 'redirects',
        data: { from: '/dup', to: '/b', StatusCode: 301, enabled: true },
        overrideAccess: true,
      })
    ).rejects.toThrow()
  })

  it('allows update when only to changes (same from)', async () => {
    await handle.resetRedirects()
    const created = await handle.payload.create({
      collection: 'redirects',
      data: { from: '/matrix-from', to: '/target-a', StatusCode: 301, enabled: true },
      overrideAccess: true,
    })

    const updated = await handle.payload.update({
      collection: 'redirects',
      id: created.id,
      data: { to: '/target-b' },
      overrideAccess: true,
    })

    expect(updated.to).toBe('/target-b')
    expect(updated.from).toBe('/matrix-from')
  })
})
