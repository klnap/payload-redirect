import { describe, expect, it } from 'bun:test'
import { RedirectValidationError } from '#redirect/core/redirects/model/errors'
import {
  assertRedirectStatusCode,
  DEFAULT_REDIRECT_STATUS_CODE,
  isRedirectStatusCode,
  validateDestinationForStatus,
} from '#redirect/core/redirects/model/status-code'

describe('status-code', () => {
  it('defaults to 301', () => {
    expect(DEFAULT_REDIRECT_STATUS_CODE).toBe(301)
  })

  it('accepts 301 and 302 (number or stored string)', () => {
    expect(assertRedirectStatusCode(301)).toBe(301)
    expect(assertRedirectStatusCode(302)).toBe(302)
    expect(assertRedirectStatusCode('301')).toBe(301)
    expect(assertRedirectStatusCode('302')).toBe(302)
    expect(isRedirectStatusCode(301)).toBe(true)
    expect(isRedirectStatusCode(302)).toBe(true)
    expect(isRedirectStatusCode('301')).toBe(true)
  })

  it('rejects 404 and 410', () => {
    expect(isRedirectStatusCode(404)).toBe(false)
    expect(isRedirectStatusCode(410)).toBe(false)
    expect(() => assertRedirectStatusCode(404)).toThrow(RedirectValidationError)
    expect(() => assertRedirectStatusCode(410)).toThrow(RedirectValidationError)
  })

  it('301/302 require destination', () => {
    expect(() => validateDestinationForStatus(301, null)).toThrow(RedirectValidationError)
    validateDestinationForStatus(302, '/ok')
  })
})
