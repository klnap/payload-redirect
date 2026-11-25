import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from '../helpers/payload-harness'

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const resolvesWithin = (promise: Promise<unknown>, ms: number) =>
  Promise.race([
    promise.then(
      () => true,
      () => true
    ),
    sleep(ms).then(() => false),
  ])

/**
 * Deterministic interleaving: writer A holds an uncommitted A -> B rule in its transaction. Writer B
 * then tries to create B -> A. The graph lock must make B wait; after A commits, B must see the cycle.
 */
describe.skipIf(!intDatabaseConfigured)('redirect rule graph lock (postgres)', () => {
  let handle: RedirectIntHandle

  beforeAll(async () => {
    handle = await createRedirectIntPayload()
  }, 120_000)

  afterAll(async () => {
    await handle.destroy()
  })

  it('a concurrent write that would close a cycle waits for the first and is then refused', async () => {
    await handle.resetRedirects()
    const db = handle.payload.db as unknown as {
      beginTransaction: () => Promise<string | number | null>
      commitTransaction: (id: string | number) => Promise<void>
      rollbackTransaction: (id: string | number) => Promise<void>
    }

    const txA = await db.beginTransaction()
    const txB = await db.beginTransaction()
    if (txA == null || txB == null) throw new Error('transactions unavailable')

    try {
      await handle.payload.create({
        collection: 'redirects',
        data: { from: '/loop-a', to: '/loop-b', StatusCode: 301, enabled: true },
        overrideAccess: true,
        req: { transactionID: txA } as never,
      })

      const second = handle.payload.create({
        collection: 'redirects',
        data: { from: '/loop-b', to: '/loop-a', StatusCode: 301, enabled: true },
        overrideAccess: true,
        req: { transactionID: txB } as never,
      })

      expect(await resolvesWithin(second, 400)).toBe(false)

      await db.commitTransaction(txA)
      await expect(second).rejects.toThrow(/invalid: to/)
    } finally {
      await db.rollbackTransaction(txA).catch(() => undefined)
      await db.rollbackTransaction(txB).catch(() => undefined)
    }
  })

  it('serializes concurrent updates that would close a cycle', async () => {
    await handle.resetRedirects()
    const first = await handle.payload.create({
      collection: 'redirects',
      data: { from: '/update-a', to: '/terminal-a', StatusCode: 301, enabled: true },
      overrideAccess: true,
    })
    const second = await handle.payload.create({
      collection: 'redirects',
      data: { from: '/update-b', to: '/terminal-b', StatusCode: 301, enabled: true },
      overrideAccess: true,
    })
    const db = handle.payload.db as unknown as {
      beginTransaction: () => Promise<string | number | null>
      commitTransaction: (id: string | number) => Promise<void>
      rollbackTransaction: (id: string | number) => Promise<void>
    }

    const txA = await db.beginTransaction()
    const txB = await db.beginTransaction()
    if (txA == null || txB == null) throw new Error('transactions unavailable')

    try {
      await handle.payload.update({
        collection: 'redirects',
        id: first.id,
        data: { to: '/update-b' },
        overrideAccess: true,
        req: { transactionID: txA } as never,
      })

      const closingUpdate = handle.payload.update({
        collection: 'redirects',
        id: second.id,
        data: { to: '/update-a' },
        overrideAccess: true,
        req: { transactionID: txB } as never,
      })

      expect(await resolvesWithin(closingUpdate, 400)).toBe(false)
      await db.commitTransaction(txA)
      await expect(closingUpdate).rejects.toThrow(/invalid: to/)
    } finally {
      await db.rollbackTransaction(txA).catch(() => undefined)
      await db.rollbackTransaction(txB).catch(() => undefined)
    }
  })
})
