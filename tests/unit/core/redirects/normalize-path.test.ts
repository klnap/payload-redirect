import { describe, expect, it } from 'bun:test'
import { RedirectValidationError } from '#redirect/core/redirects/model/errors'
import {
  assertRelativeRedirectPath,
  normalizePathOrUrl,
  normalizeRelativeRedirectPath,
  pathsEqual,
} from '#redirect/core/redirects/normalize-path'

describe('url normalization', () => {
  it('adds leading slash to paths', () => {
    expect(normalizePathOrUrl('blog/old')).toBe('/blog/old')
  })

  it('collapses duplicate slashes in path', () => {
    expect(normalizePathOrUrl('/blog//old')).toBe('/blog/old')
  })

  it('removes trailing slash except root', () => {
    expect(normalizePathOrUrl('/blog/old/')).toBe('/blog/old')
    expect(normalizePathOrUrl('/')).toBe('/')
  })

  it('preserves query and fragment on absolute URLs', () => {
    expect(normalizePathOrUrl('https://example.com/a/?q=1#frag')).toBe(
      'https://example.com/a?q=1#frag'
    )
  })

  it('rejects empty paths', () => {
    expect(() => normalizePathOrUrl('   ')).toThrow(RedirectValidationError)
  })

  it('pathsEqual uses normalization', () => {
    expect(pathsEqual('/a/', 'a')).toBe(true)
  })
})

describe('relative redirect paths', () => {
  it('normalizes valid relative paths', () => {
    expect(normalizeRelativeRedirectPath('blog/old')).toBe('/blog/old')
  })

  it('rejects protocol and hostname forms', () => {
    expect(() => assertRelativeRedirectPath('https://example.com/a')).toThrow(
      RedirectValidationError
    )
    expect(() => assertRelativeRedirectPath('//cdn.example/a')).toThrow(RedirectValidationError)
    expect(() => assertRelativeRedirectPath('www.example.com/page')).toThrow(
      RedirectValidationError
    )
  })
})
