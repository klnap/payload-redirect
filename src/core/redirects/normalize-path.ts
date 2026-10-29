import { RedirectValidationError } from '#redirect/core/redirects/model/errors'

const RELATIVE_PATH_MESSAGE =
  'Path must be site-relative (e.g. /blog/post). Do not include a protocol or hostname.'

/**
 * Admin / manual rules: site-relative paths only (no absolute URLs).
 */
export const assertRelativeRedirectPath = (input: string): void => {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new RedirectValidationError('from/to must be a non-empty path or URL')
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    throw new RedirectValidationError(RELATIVE_PATH_MESSAGE)
  }

  if (trimmed.startsWith('//')) {
    throw new RedirectValidationError(RELATIVE_PATH_MESSAGE)
  }

  const pathOnly = trimmed.split(/[?#]/)[0] ?? ''
  const firstSegment = pathOnly.replace(/^\/+/, '').split('/')[0] ?? ''
  if (firstSegment && looksLikeHostname(firstSegment)) {
    throw new RedirectValidationError(RELATIVE_PATH_MESSAGE)
  }
}

const looksLikeHostname = (segment: string): boolean => {
  if (!segment.includes('.')) {
    return false
  }
  if (segment === '.' || segment === '..') {
    return false
  }
  return /^[a-zA-Z0-9.-]+$/.test(segment)
}

/**
 * Canonical path/URL for storage and lookup.
 * Minimal normalization — no destructive reshaping of materially different URLs.
 */
export const normalizePathOrUrl = (input: string): string => {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new RedirectValidationError('from/to must be a non-empty path or URL')
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    return normalizeAbsoluteUrl(trimmed)
  }

  return normalizePath(trimmed)
}

/** Normalize a site-relative path (no protocol/host). */
export const normalizeRelativeRedirectPath = (input: string): string => {
  assertRelativeRedirectPath(input)
  return normalizePath(input.trim())
}

const normalizePath = (path: string): string => {
  let p = path
  if (!p.startsWith('/')) {
    p = `/${p}`
  }
  p = p.replace(/\/{2,}/g, '/')
  if (p.length > 1 && p.endsWith('/')) {
    p = p.slice(0, -1)
  }
  return p === '' ? '/' : p
}

const normalizeAbsoluteUrl = (url: string): string => {
  try {
    const parsed = new URL(url)
    parsed.pathname = normalizePath(parsed.pathname || '/')
    return parsed.toString()
  } catch {
    throw new RedirectValidationError(`Invalid absolute URL: ${url}`)
  }
}

export const pathsEqual = (a: string, b: string): boolean =>
  normalizePathOrUrl(a) === normalizePathOrUrl(b)
