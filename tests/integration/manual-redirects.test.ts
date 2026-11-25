import { describe, expect, it } from 'bun:test'
import { createManualRedirect } from '../helpers/factories/redirect'
import { createRedirectIntPayload, intDatabaseConfigured } from '../helpers/payload-harness'

const findRule = async (payload: Parameters<typeof createManualRedirect>[0], from: string) => {
  const result = await payload.find({
    collection: 'redirects',
    where: { from: { equals: from } },
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })
  return result.docs[0]
}

describe.skipIf(!intDatabaseConfigured)('manual redirects', () => {
  it('preserves query strings containing repeated slashes', async () => {
    const handle = await createRedirectIntPayload()
    try {
      const from = '/old?return=https://example.test/a'
      await createManualRedirect(handle.payload, { from, to: '/new', StatusCode: 301 })
      expect(await findRule(handle.payload, from)).toMatchObject({
        from,
        StatusCode: '301',
        to: '/new',
      })
      expect(await findRule(handle.payload, '/old?return=https:/example.test/a')).toBeUndefined()
    } finally {
      await handle.destroy()
    }
  })

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

      expect(await findRule(handle.payload, '/perm')).toMatchObject({ to: '/target' })
      expect(await findRule(handle.payload, '/temp')).toMatchObject({ to: '/other' })
      expect(await findRule(handle.payload, '/off')).toMatchObject({ enabled: false })
    } finally {
      await handle.destroy()
    }
  })
})
