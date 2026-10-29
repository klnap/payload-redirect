import { describe, expect, it } from 'bun:test'
import { resolveRedirect } from '@klnap/payload-redirect'
import { createManualRedirect } from '../helpers/factories/redirect'
import { createRedirectIntPayload, intDatabaseConfigured } from '../helpers/payload-harness'

describe.skipIf(!intDatabaseConfigured)('manual redirects', () => {
  it('resolves 301/302 and ignores disabled', async () => {
    const handle = await createRedirectIntPayload()
    try {
      await createManualRedirect(handle.payload, { from: '/perm', to: '/target', StatusCode: 301 })
      await createManualRedirect(handle.payload, { from: '/temp', to: '/other', StatusCode: 302 })
      await createManualRedirect(handle.payload, {
        from: '/off',
        to: '/nope',
        StatusCode: 301,
        enabled: false,
      })

      expect(await resolveRedirect({ payload: handle.payload, from: '/perm' })).toEqual({
        statusCode: 301,
        to: '/target',
      })
      expect(await resolveRedirect({ payload: handle.payload, from: '/temp' })).toEqual({
        statusCode: 302,
        to: '/other',
      })
      expect(await resolveRedirect({ payload: handle.payload, from: '/off' })).toBeNull()
    } finally {
      await handle.destroy()
    }
  })
})
