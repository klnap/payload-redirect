import { describe, expect, it, mock } from 'bun:test'
import {
  RedirectAmbiguousRuleError,
  RedirectValidationError,
} from '#redirect/core/redirects/model/errors'
import { resolveRedirect } from '#redirect/core/redirects/resolution/resolve'
import {
  redirectLogicalIdentity,
  toResolvedRedirect,
} from '#redirect/core/redirects/resolution/resolved'

describe('resolveRedirect ambiguity', () => {
  it('normalizes relative paths and rejects non-path sources', async () => {
    const find = mock(async () => ({ totalDocs: 0, docs: [] }))
    const payload = {
      config: { custom: { payloadRedirect: { collectionSlug: 'redirects' } } },
      find,
    } as never

    await expect(resolveRedirect({ payload, from: '/café' })).resolves.toBeNull()
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { from: { equals: '/café' } } })
    )
    for (const from of ['https://example.com/old', '//example.com/old', '/old#section']) {
      await expect(resolveRedirect({ payload, from })).rejects.toBeInstanceOf(
        RedirectValidationError
      )
    }
  })

  it('throws when multiple enabled matches exist', async () => {
    const payload: {
      config: { custom: { payloadRedirect: { collectionSlug: string } } }
      find: () => Promise<{ totalDocs: number; docs: unknown[] }>
    } = {
      config: { custom: { payloadRedirect: { collectionSlug: 'redirects' } } },
      find: async () => ({
        totalDocs: 2,
        docs: [
          { from: '/x', to: '/a', StatusCode: 301, enabled: true },
          { from: '/x', to: '/b', StatusCode: 301, enabled: true },
        ],
      }),
    }

    await expect(resolveRedirect({ payload: payload as never, from: '/x' })).rejects.toBeInstanceOf(
      RedirectAmbiguousRuleError
    )
  })

  it('returns null for missing documents and resolves enabled valid rules', async () => {
    const payload: {
      config: { custom: { payloadRedirect: { collectionSlug: string } } }
      find: () => Promise<{ totalDocs: number; docs: unknown[] }>
    } = {
      config: { custom: { payloadRedirect: { collectionSlug: 'redirects' } } },
      find: async () => ({ totalDocs: 0, docs: [] }),
    }
    await expect(
      resolveRedirect({ payload: payload as never, from: '/missing' })
    ).resolves.toBeNull()

    payload.find = async () => ({
      totalDocs: 1,
      docs: [{ from: '/old', to: ' /new ', StatusCode: 302, enabled: true }],
    })
    await expect(resolveRedirect({ payload: payload as never, from: '/old' })).resolves.toEqual({
      statusCode: 302,
      to: '/new',
    })
  })

  it('rejects disabled, malformed, and empty destination records', () => {
    const base = { from: '/old', to: '/new', StatusCode: 301 as const, enabled: true }
    expect(toResolvedRedirect({ ...base, enabled: false })).toBeNull()
    expect(toResolvedRedirect({ ...base, StatusCode: 307 as never })).toBeNull()
    expect(toResolvedRedirect({ ...base, to: '  ' })).toBeNull()
    expect(redirectLogicalIdentity(base)).toBe('/old\u0000/new\u0000301')
    expect(redirectLogicalIdentity({ ...base, to: null })).toBe('/old\u0000\u0000301')
  })
})
