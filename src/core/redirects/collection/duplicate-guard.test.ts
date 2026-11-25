import { describe, expect, it, mock } from 'bun:test'
import {
  createDuplicateBeforeChange,
  findDuplicateFrom,
  MAX_REDIRECT_CHAIN_HOPS,
  resolveDuplicateGuardExcludeId,
  resolveNormalizedFrom,
} from '#redirect/core/redirects/collection/duplicate-guard'

describe('resolveDuplicateGuardExcludeId', () => {
  it('returns undefined on create', () => {
    expect(resolveDuplicateGuardExcludeId('create', { id: 'abc' })).toBeUndefined()
  })

  it('returns originalDoc id on update', () => {
    expect(
      resolveDuplicateGuardExcludeId('update', { id: 'd48e2f36-f45b-4322-8065-d51d436d6436' })
    ).toBe('d48e2f36-f45b-4322-8065-d51d436d6436')
    expect(resolveDuplicateGuardExcludeId('update', { id: 42 })).toBe(42)
  })

  it('returns undefined on update without originalDoc or id', () => {
    expect(resolveDuplicateGuardExcludeId('update', undefined)).toBeUndefined()
    expect(resolveDuplicateGuardExcludeId('update', {})).toBeUndefined()
  })

  it('normalizes valid paths and skips missing or invalid values for lookup helpers', () => {
    expect(resolveNormalizedFrom({ from: ' /hello ' })).toBe('/hello')
    expect(resolveNormalizedFrom({ from: '' })).toBeUndefined()
    expect(resolveNormalizedFrom({ from: 42 })).toBeUndefined()
    expect(resolveNormalizedFrom({ from: 'http://[invalid' })).toBeUndefined()
  })

  it('checks duplicates with privileged access: the guard must see every rule', async () => {
    const find = mock(async () => ({ docs: [{ id: 'existing' }] }))
    const req = { payload: { find } } as never

    expect(
      await findDuplicateFrom({ req, collectionSlug: 'redirects', normalizedFrom: '/from' })
    ).toBe(true)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'redirects',
        where: { from: { equals: '/from' } },
        overrideAccess: true,
        select: { id: true },
      })
    )
  })

  it('normalizes beforeChange data and rejects malformed source paths', async () => {
    const find = mock(async () => ({ docs: [] }))
    const req = {
      payload: {
        config: { custom: { payloadRedirect: { collectionSlug: 'redirects' } } },
        find,
      },
      context: {},
    } as never
    const hook = createDuplicateBeforeChange()
    const data = { from: ' /hello ', to: ' /world ' }

    await expect(hook({ data, req, operation: 'create' } as never)).resolves.toBe(data)
    expect(data.from).toBe('/hello')
    expect(data.to).toBe('/world')
    expect(find).toHaveBeenCalledTimes(2)
    await expect(
      hook({ data: undefined, req, operation: 'create' } as never)
    ).resolves.toBeUndefined()
    await expect(
      hook({ data: { from: 'http://[invalid', to: '/valid' }, req, operation: 'create' } as never)
    ).rejects.toThrow('The following field is invalid: from')
    expect(find).toHaveBeenCalledTimes(2)
  })

  it('rejects a duplicate normalized source path', async () => {
    const req = {
      payload: {
        config: { custom: { payloadRedirect: { collectionSlug: 'redirects' } } },
        find: mock(async () => ({ docs: [{ id: 'duplicate' }] })),
      },
      context: {},
    } as never

    await expect(
      createDuplicateBeforeChange()({
        data: { from: '/same', to: '/target' },
        req,
        operation: 'create',
      } as never)
    ).rejects.toThrow('The following field is invalid: from')
  })
})

describe('createDuplicateBeforeChange direct loop', () => {
  const buildReq = (reverse: Record<string, unknown> | undefined) => {
    const find = mock(async (args: { where: { from: { equals: string } } }) => ({
      docs: args.where.from.equals === '/b' && reverse ? [{ id: 'other', ...reverse }] : [],
    }))
    return {
      find,
      req: {
        payload: {
          config: { custom: { payloadRedirect: { collectionSlug: 'redirects' } } },
          find,
        },
        context: {},
      } as never,
    }
  }

  it('rejects a rule whose to points back to an enabled rule from the same path', async () => {
    const { req, find } = buildReq({ from: '/b', to: '/a', enabled: true })

    await expect(
      createDuplicateBeforeChange()({
        data: { from: '/a', to: '/b', enabled: true },
        req,
        operation: 'create',
      } as never)
    ).rejects.toThrow('The following field is invalid: to')
    expect(find).toHaveBeenCalledTimes(2)
  })

  it('allows the rule when the reverse rule is disabled', async () => {
    const { req } = buildReq({ from: '/b', to: '/a', enabled: false })
    const data = { from: '/a', to: '/b', enabled: true }

    await expect(
      createDuplicateBeforeChange()({ data, req, operation: 'create' } as never)
    ).resolves.toBe(data)
  })

  it('allows the rule when no rule starts at the destination', async () => {
    const { req } = buildReq(undefined)
    const data = { from: '/a', to: '/b' }

    await expect(
      createDuplicateBeforeChange()({ data, req, operation: 'create' } as never)
    ).resolves.toBe(data)
  })
})

describe('createDuplicateBeforeChange chain loops', () => {
  /** Rules keyed by `from`; `find` answers the `from` lookups the guard makes. */
  const buildReq = (rules: Record<string, { to: string; enabled?: boolean }>) => {
    const find = mock(async (args: { where: { from: { equals: string } } }) => {
      const rule = rules[args.where.from.equals]
      return {
        docs: rule
          ? [
              {
                id: `rule-${args.where.from.equals}`,
                from: args.where.from.equals,
                ...rule,
                enabled: rule.enabled ?? true,
              },
            ]
          : [],
      }
    })
    return {
      find,
      req: {
        payload: {
          config: { custom: { payloadRedirect: { collectionSlug: 'redirects' } } },
          find,
        },
        context: {},
      } as never,
    }
  }

  /** Rules `/c0 -> /c1 -> ... -> /c<length>`, so writing `/a -> /c0` follows `length` rules. */
  const chainOf = (length: number) =>
    Object.fromEntries(
      Array.from({ length }, (_, index) => [`/c${index}`, { to: `/c${index + 1}` }])
    )

  it('rejects a three-rule cycle back to the source path', async () => {
    const { req, find } = buildReq({ '/b': { to: '/c' }, '/c': { to: '/a' } })

    await expect(
      createDuplicateBeforeChange()({
        data: { from: '/a', to: '/b', enabled: true },
        req,
        operation: 'create',
      } as never)
    ).rejects.toThrow('The following field is invalid: to')
    expect(find).toHaveBeenCalledTimes(3)
  })

  it('rejects a cycle through the source path of any length', async () => {
    const { req, find } = buildReq({
      '/b': { to: '/c' },
      '/c': { to: '/d' },
      '/d': { to: '/e' },
      '/e': { to: '/f' },
      '/f': { to: '/a' },
    })

    await expect(
      createDuplicateBeforeChange()({
        data: { from: '/a', to: '/b', enabled: true },
        req,
        operation: 'create',
      } as never)
    ).rejects.toThrow('The following field is invalid: to')
    expect(find).toHaveBeenCalledTimes(6)
  })

  it('rejects a destination chain that enters a cycle', async () => {
    const { req, find } = buildReq({ '/b': { to: '/c' }, '/c': { to: '/d' }, '/d': { to: '/c' } })

    await expect(
      createDuplicateBeforeChange()({
        data: { from: '/a', to: '/b', enabled: true },
        req,
        operation: 'create',
      } as never)
    ).rejects.toThrow('The following field is invalid: to')
    expect(find).toHaveBeenCalledTimes(4)
  })

  it('rejects a self-loop without a lookup of the same path', async () => {
    const { req } = buildReq({})

    await expect(
      createDuplicateBeforeChange()({
        data: { from: '/a', to: '/a', enabled: true },
        req,
        operation: 'create',
      } as never)
    ).rejects.toThrow('The following field is invalid: to')
  })

  it('rejects a self-loop through literal or encoded dot segments', async () => {
    const { req } = buildReq({})
    for (const to of ['/a/../a', '/%2e/a', '/a/%2E%2e/a', '/a#section']) {
      await expect(
        createDuplicateBeforeChange()({
          data: { from: '/a', to, enabled: true },
          req,
          operation: 'create',
        } as never)
      ).rejects.toThrow('The following field is invalid: to')
    }
  })

  it('rejects unsafe destinations at the collection hook boundary', async () => {
    const { req } = buildReq({})
    for (const to of ['https://example.com', '//example.com', 'javascript:alert(1)']) {
      await expect(
        createDuplicateBeforeChange()({
          data: { from: '/safe', to, enabled: true },
          req,
          operation: 'create',
        } as never)
      ).rejects.toThrow('The following field is invalid: to')
    }
  })

  it('accepts a two-hop chain that terminates', async () => {
    const { req, find } = buildReq({ '/b': { to: '/c' } })
    const data = { from: '/a', to: '/b', enabled: true }

    await expect(
      createDuplicateBeforeChange()({ data, req, operation: 'create' } as never)
    ).resolves.toBe(data)
    expect(find).toHaveBeenCalledTimes(3)
  })

  it('ignores disabled rules in the chain', async () => {
    const { req } = buildReq({ '/b': { to: '/a', enabled: false } })
    const data = { from: '/a', to: '/b', enabled: true }

    await expect(
      createDuplicateBeforeChange()({ data, req, operation: 'create' } as never)
    ).resolves.toBe(data)
  })

  it('accepts a chain of exactly MAX_REDIRECT_CHAIN_HOPS rules', async () => {
    const { req } = buildReq({ '/b': { to: '/c0' }, ...chainOf(MAX_REDIRECT_CHAIN_HOPS - 1) })
    const data = { from: '/a', to: '/b', enabled: true }

    await expect(
      createDuplicateBeforeChange()({ data, req, operation: 'create' } as never)
    ).resolves.toBe(data)
  })

  it('rejects a chain beyond the hard cap as unverifiable', async () => {
    const { req, find } = buildReq({ '/b': { to: '/c0' }, ...chainOf(MAX_REDIRECT_CHAIN_HOPS) })

    await expect(
      createDuplicateBeforeChange()({
        data: { from: '/a', to: '/b', enabled: true },
        req,
        operation: 'create',
      } as never)
    ).rejects.toThrow('The following field is invalid: to')
    expect(find).toHaveBeenCalledTimes(MAX_REDIRECT_CHAIN_HOPS + 2)
  })
})

describe('loop walk is not blinded by requester read access', () => {
  it('refuses a cycle closed through a rule the requester cannot read', async () => {
    // Stored: /c -> /a is enabled, but only privileged reads return it.
    const rules: Record<string, { from: string; to: string; enabled: boolean }> = {
      '/c': { from: '/c', to: '/a', enabled: true },
    }
    const find = mock(
      async (args: { where: { from: { equals: string } }; overrideAccess?: boolean }) => {
        const rule = rules[args.where.from.equals]
        if (args.overrideAccess !== true || !rule) return { docs: [] }
        return { docs: [{ id: 'r-c', ...rule }] }
      }
    )
    const req = {
      payload: { find, config: {} },
      user: { id: 'u1', type: 'human' },
    } as never
    const hook = createDuplicateBeforeChange()
    await expect(
      hook({
        data: { from: '/a', to: '/c', enabled: true, StatusCode: 301 },
        operation: 'create',
        req,
      } as never)
    ).rejects.toThrow()
  })
})
