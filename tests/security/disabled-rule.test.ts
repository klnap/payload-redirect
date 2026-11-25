import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { createManualRedirect } from '../helpers/factories/redirect'
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from '../helpers/payload-harness'

describe.skipIf(!intDatabaseConfigured)('disabled rule', () => {
  let handle: RedirectIntHandle

  beforeAll(async () => {
    handle = await createRedirectIntPayload()
  })

  afterAll(async () => {
    await handle.destroy()
  })

  it('disabled rules do not resolve', async () => {
    await handle.resetRedirects()
    await createManualRedirect(handle.payload, { from: '/off', to: '/x', enabled: false })
    const result = await handle.payload.find({
      collection: 'redirects',
      where: { from: { equals: '/off' } },
      limit: 1,
      pagination: false,
      overrideAccess: true,
    })
    expect(result.docs[0]?.enabled).toBe(false)
  })
})
