import { describe, expect, it } from 'bun:test'
import { createRedirectOriginBeforeChange } from '#redirect/core/redirects/collection/origin-hook'
import { REDIRECT_CONTEXT_KEYS } from '#redirect/core/redirects/context-keys'

describe('redirect origin hook', () => {
  const hook = createRedirectOriginBeforeChange()

  it('forces auto origin for internal creates', async () => {
    const data = { from: '/a', to: '/b' }
    const result = await hook({
      data,
      operation: 'create',
      req: { context: { [REDIRECT_CONTEXT_KEYS.internal]: true } },
    } as never)
    expect(result?.origin).toBe('auto')
  })

  it('forces manual origin for admin creates', async () => {
    const data = { from: '/a', to: '/b', origin: 'auto' }
    const result = await hook({
      data,
      operation: 'create',
      req: { context: {} },
    } as never)
    expect(result?.origin).toBe('manual')
  })

  it('converts auto origin to manual on admin update', async () => {
    const data = { from: '/a', to: '/b', origin: 'auto' }
    const result = await hook({
      data,
      operation: 'update',
      originalDoc: { origin: 'auto' },
      req: { context: {} },
    } as never)
    expect(result?.origin).toBe('manual')
  })
})
