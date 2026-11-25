import { describe, expect, it } from 'bun:test'
import { getRedirectRuntime, registerRedirectRuntime } from './runtime'

describe('redirect runtime configuration', () => {
  it('registers runtime values while preserving existing custom config', () => {
    const custom = registerRedirectRuntime({ custom: { existing: true } } as never, {
      collectionSlug: 'redirects',
      localePrefix: { en: '' },
    })
    expect(custom).toEqual({
      existing: true,
      payloadRedirect: { collectionSlug: 'redirects', localePrefix: { en: '' } },
    })
    expect(getRedirectRuntime({ custom } as never)).toEqual(custom?.payloadRedirect)
  })

  it('throws when the plugin runtime is missing', () => {
    expect(() => getRedirectRuntime({ custom: {} } as never)).toThrow(
      'payload-redirect: plugin runtime missing — add redirects() to payload config'
    )
    expect(() => getRedirectRuntime({ custom: { payloadRedirect: {} } } as never)).toThrow()
  })
})
