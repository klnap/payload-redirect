import { RedirectValidationError } from '#redirect/core/redirects/model/errors'

export type RedirectStatusCode = 301 | 302

const SUPPORTED: readonly RedirectStatusCode[] = [301, 302]

export const DEFAULT_REDIRECT_STATUS_CODE: RedirectStatusCode = 301

const normalizeStatusCode = (value: unknown): RedirectStatusCode | undefined => {
  const n = typeof value === 'string' ? Number(value) : value
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined
  if ((SUPPORTED as readonly number[]).includes(n)) {
    return n as RedirectStatusCode
  }
  return undefined
}

export const isRedirectStatusCode = (value: unknown): value is RedirectStatusCode =>
  normalizeStatusCode(value) !== undefined

export const assertRedirectStatusCode = (value: unknown): RedirectStatusCode => {
  const code = normalizeStatusCode(value)
  if (code === undefined) {
    throw new RedirectValidationError(`StatusCode must be one of ${SUPPORTED.join(', ')}`)
  }
  return code
}

export const requiresDestination = (_statusCode: RedirectStatusCode): boolean => true

export const validateDestinationForStatus = (statusCode: RedirectStatusCode, to: unknown): void => {
  const hasTo = typeof to === 'string' && to.trim().length > 0
  if (!hasTo) {
    throw new RedirectValidationError(`StatusCode ${statusCode} requires a non-empty "to" field`)
  }
}
