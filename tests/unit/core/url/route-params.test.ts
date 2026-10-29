import { describe, expect, it } from 'bun:test'
import {
  applyDynamicSegments,
  extractDynamicSegments,
  readValueAtPath,
  resolveRouteParam,
  templateHasUnsupportedDynamicSyntax,
} from '#redirect/core/url/route-params'

describe('readValueAtPath hardening', () => {
  const data = { seo: { slug: 'ok' }, slug: 'top' }

  it('blocks prototype-pollution path segments', () => {
    expect(readValueAtPath(data, '__proto__.x')).toBeUndefined()
    expect(readValueAtPath(data, 'constructor.x')).toBeUndefined()
    expect(readValueAtPath(data, 'prototype.x')).toBeUndefined()
  })

  it('rejects malformed paths', () => {
    expect(readValueAtPath(data, 'foo..bar')).toBeUndefined()
    expect(readValueAtPath(data, '.foo')).toBeUndefined()
    expect(readValueAtPath(data, 'foo.')).toBeUndefined()
    expect(readValueAtPath(data, '')).toBeUndefined()
  })

  it('does not traverse arrays', () => {
    expect(readValueAtPath({ items: ['a'] }, 'items.0')).toBeUndefined()
  })
})

describe('dynamic segment parsing', () => {
  it('extracts supported param names', () => {
    expect(extractDynamicSegments('/projects/[slug]')).toEqual(['slug'])
    expect(extractDynamicSegments('/users/[userId]/posts/[postId]')).toEqual(['userId', 'postId'])
  })

  it('rejects catch-all and optional catch-all syntax', () => {
    expect(templateHasUnsupportedDynamicSyntax('/blog/[...slug]')).toBe(true)
    expect(templateHasUnsupportedDynamicSyntax('/blog/[[...slug]]')).toBe(true)
    expect(extractDynamicSegments('/blog/[...slug]')).toEqual([])
    expect(
      applyDynamicSegments('/blog/[...slug]', { slug: 'x' }, 'en', { slug: 'slug' })
    ).toBeNull()
  })
})

describe('resolveRouteParam without implicit slug fallback', () => {
  it('returns null when routeParams is undefined or empty', () => {
    expect(resolveRouteParam('slug', { slug: 'x' }, 'en', undefined)).toBeNull()
    expect(resolveRouteParam('slug', { slug: 'x' }, 'en', {})).toBeNull()
  })
})
