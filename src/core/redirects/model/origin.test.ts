import { describe, expect, it } from 'bun:test'
import { isRedirectOrigin, REDIRECT_ORIGIN_VALUES } from '#redirect/core/redirects/model/origin'

describe('RedirectOrigin', () => {
  it('accepts manual and auto', () => {
    expect(REDIRECT_ORIGIN_VALUES).toEqual(['manual', 'auto'])
    expect(isRedirectOrigin('manual')).toBe(true)
    expect(isRedirectOrigin('auto')).toBe(true)
  })

  it('rejects automatic', () => {
    expect(isRedirectOrigin('automatic')).toBe(false)
  })
})
