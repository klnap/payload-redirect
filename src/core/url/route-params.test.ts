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
    expect(readValueAtPath({ slug: 'plain' }, 'slug.value')).toBeUndefined()
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

describe('applyDynamicSegments dot segments', () => {
  it('returns null when a param is "." or ".."', () => {
    expect(applyDynamicSegments('/blog/[slug]', { slug: '..' }, 'en', { slug: 'slug' })).toBeNull()
    expect(applyDynamicSegments('/blog/[slug]', { slug: '.' }, 'en', { slug: 'slug' })).toBeNull()
    expect(applyDynamicSegments('/blog/[slug]', { slug: '..x' }, 'en', { slug: 'slug' })).toBe(
      '/blog/..x'
    )
  })
})

describe('resolveRouteParam without implicit slug fallback', () => {
  it('returns null when routeParams is undefined or empty', () => {
    expect(resolveRouteParam('slug', { slug: 'x' }, 'en', undefined)).toBeNull()
    expect(resolveRouteParam('slug', { slug: 'x' }, 'en', {})).toBeNull()
  })

  it('coerces finite numeric mappings and rejects invalid mappings or values', () => {
    expect(resolveRouteParam('id', { id: 0 }, 'en', { id: 'id' })).toBe('0')
    expect(resolveRouteParam('id', { id: Number.NaN }, 'en', { id: 'id' })).toBeNull()
    expect(
      resolveRouteParam('id', { id: { en: 3 } }, 'en', { id: { field: 'id', localized: true } })
    ).toBeNull()
    expect(resolveRouteParam('id', { id: 'x' }, 'en', { id: { field: '' } })).toBeNull()
    expect(resolveRouteParam('id', { id: 'x' }, 'en', { id: '' })).toBeNull()
  })
})
