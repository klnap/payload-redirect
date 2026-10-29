import { describe, expect, it } from 'bun:test'
import { RedirectAmbiguousRuleError } from '#redirect/core/redirects/model/errors'
import { resolveRedirect } from '#redirect/core/redirects/resolution/resolve'

describe('resolveRedirect ambiguity', () => {
  it('throws when multiple enabled matches exist', async () => {
    const payload = {
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
})
