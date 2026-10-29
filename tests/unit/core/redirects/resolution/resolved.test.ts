import { describe, expect, it } from 'bun:test'
import { toResolvedRedirect } from '#redirect/core/redirects/resolution/resolved'

describe('toResolvedRedirect', () => {
  it('301 with destination', () => {
    expect(toResolvedRedirect({ from: '/a', to: '/b', StatusCode: 301, enabled: true })).toEqual({
      statusCode: 301,
      to: '/b',
    })
  })

  it('302 with destination', () => {
    expect(toResolvedRedirect({ from: '/a', to: '/b', StatusCode: 302, enabled: true })).toEqual({
      statusCode: 302,
      to: '/b',
    })
  })

  it('returns null for unsupported status codes', () => {
    expect(toResolvedRedirect({ from: '/a', StatusCode: 404 as never, enabled: true })).toBeNull()
    expect(toResolvedRedirect({ from: '/a', StatusCode: 410 as never, enabled: true })).toBeNull()
  })

  it('disabled returns null', () => {
    expect(toResolvedRedirect({ from: '/a', to: '/b', StatusCode: 301, enabled: false })).toBeNull()
  })
})
