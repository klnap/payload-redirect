import { describe, expect, it } from 'bun:test'
import { buildPreviewPath, type PreviewRoutes } from '#redirect/core/url/preview-routes'
import {
  extractDynamicSegments,
  type RouteParamsConfig,
  readValueAtPath,
  resolveRouteParam,
} from '#redirect/core/url/route-params'

const staticRoutes: PreviewRoutes = {
  '/about': { en: '/about', pl: '/o-nas' },
}

const singleSlugRoutes: PreviewRoutes = {
  '/projects/[slug]': { en: '/projects/[slug]', pl: '/projekty/[slug]' },
}

describe('extractDynamicSegments', () => {
  it('returns empty for static paths', () => {
    expect(extractDynamicSegments('/about')).toEqual([])
  })

  it('extracts single and multiple param names in order', () => {
    expect(extractDynamicSegments('/projects/[slug]')).toEqual(['slug'])
    expect(extractDynamicSegments('/blog/[category]/[postId]')).toEqual(['category', 'postId'])
  })
})

describe('readValueAtPath', () => {
  it('reads nested fields', () => {
    const data = { seo: { slug: 'nested' } }
    expect(readValueAtPath(data, 'seo.slug')).toBe('nested')
  })
})

describe('resolveRouteParam', () => {
  it('uses shorthand field mapping', () => {
    const params: RouteParamsConfig = { userId: 'author.id' }
    expect(resolveRouteParam('userId', { author: { id: '5' } }, 'en', params)).toBe('5')
  })
})

const slugRouteParams: RouteParamsConfig = { slug: 'slug' }

describe('buildPreviewPath', () => {
  it('builds static pathname without parameters', () => {
    expect(buildPreviewPath(staticRoutes, {}, 'pl')).toBe('/pl/o-nas')
  })

  it('builds path when slug is mapped explicitly', () => {
    expect(buildPreviewPath(singleSlugRoutes, { slug: 'alfa' }, 'pl', slugRouteParams)).toBe(
      '/pl/projekty/alfa'
    )
  })
})
