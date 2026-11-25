import { RedirectValidationError } from '#redirect/core/redirects/model/errors'

const RELATIVE_PATH_MESSAGE =
  'Path must be site-relative (e.g. /blog/post). Do not include a protocol or hostname.'

/**
 * Admin / manual rules: site-relative paths only (no absolute URLs).
 */
export const assertRelativeRedirectPath = (input: string): void => {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new RedirectValidationError('from/to must be a non-empty site-relative path')
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    throw new RedirectValidationError(RELATIVE_PATH_MESSAGE)
  }

  if (trimmed.startsWith('//')) {
    throw new RedirectValidationError(RELATIVE_PATH_MESSAGE)
  }

  // WHATWG URL parsing treats "\" as "/" and strips tabs/newlines, so "/\evil.example"
  // or "/\t/evil.example" resolve to another origin. Reject those characters outright.
  if (hasBackslashOrControlChar(trimmed)) {
    throw new RedirectValidationError('Path must not contain backslashes or control characters.')
  }

  const pathOnly = trimmed.split(/[?#]/)[0] ?? ''
  const firstSegment = pathOnly.replace(/^\/+/, '').split('/')[0] ?? ''
  if (!trimmed.startsWith('/') && firstSegment && looksLikeHostname(firstSegment)) {
    throw new RedirectValidationError(RELATIVE_PATH_MESSAGE)
  }
}

const hasBackslashOrControlChar = (value: string): boolean => {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code === 0x5c || code < 0x20 || code === 0x7f) return true
  }
  return false
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

export const normalizeRedirectSourcePath = (input: string): string => {
  const normalized = normalizeRelativeRedirectPath(input)
  if (normalized.includes('#')) {
    throw new RedirectValidationError('from must not contain a fragment')
  }
  return normalized
}

const normalizePath = (path: string): string => {
  const boundary = path.search(/[?#]/)
  const suffix = boundary < 0 ? '' : path.slice(boundary)
  let p = boundary < 0 ? path : path.slice(0, boundary)
  if (!p.startsWith('/')) {
    p = `/${p}`
  }
  p = p.replace(/\/{2,}/g, '/')
  // Browsers resolve these segments before requesting the path.
  const segments: string[] = []
  for (const segment of p.slice(1).split('/')) {
    if (segment === '.' || /^%2e$/i.test(segment)) continue
    if (/^(?:\.\.|\.%2e|%2e\.|%2e%2e)$/i.test(segment)) {
      segments.pop()
      continue
    }
    segments.push(segment)
  }
  p = `/${segments.join('/')}`
  if (p.length > 1 && p.endsWith('/')) {
    p = p.slice(0, -1)
  }
  return `${p === '' ? '/' : p}${suffix}`
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
