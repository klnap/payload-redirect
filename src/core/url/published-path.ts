import { localeCode } from './preview-path.js'
import { buildPreviewPath, type PreviewRoutes } from './preview-routes.js'
import { applyDynamicSegments, type RouteParamsConfig } from './route-params.js'

export type LocalePrefix = Record<string, string>

export type PublishedLinkPathTemplate = {
  path?: string
  paths?: Record<string, string>
  routes?: PreviewRoutes
  params?: RouteParamsConfig
  getPath?: unknown
}

export type ResolvedPublishedPathConfig = PublishedLinkPathTemplate & {
  localePrefix: LocalePrefix
}

export function mergeLocalePrefix(plugin?: LocalePrefix, schema?: LocalePrefix): LocalePrefix {
  return Object.assign({}, plugin, schema)
}

function normalizeLocalePrefix(prefix: string): string {
  const trimmed = prefix.trim()
  if (!trimmed || trimmed === '/') return ''
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeading.replace(/\/+$/, '')
}

export function resolveLocaleRoutePrefix(localePrefix: LocalePrefix, code: string): string | null {
  if (Object.keys(localePrefix).length === 0) {
    return `/${code}`
  }
  const explicit = localePrefix[code]
  if (explicit === undefined) {
    return null
  }
  return normalizeLocalePrefix(explicit)
}

function patternForLocale(previewRoutes: PreviewRoutes, locale: unknown): string | null {
  const entries = Object.entries(previewRoutes)
  if (entries.length === 0) return null

  const first = entries[0]
  if (!first) return null
  const [, template] = first
  const code = localeCode(locale)
  if (!code) return null

  if (typeof template === 'string') return template
  return template[code] ?? null
}

export function resolvePathTemplate(
  config: Pick<PublishedLinkPathTemplate, 'path' | 'paths' | 'routes'>,
  locale: unknown
): string | null {
  const code = localeCode(locale)
  if (!code) return null
  const localized = config.paths?.[code]
  if (localized) return localized
  if (config.path) return config.path
  if (config.routes) return patternForLocale(config.routes, locale)
  return null
}

function joinPrefixAndPath(prefix: string, pathname: string): string {
  if (pathname === '/' || pathname === '') {
    return prefix || '/'
  }
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${prefix}${normalized}`
}

function isSiteRelativePath(path: string): boolean {
  return (
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('?') &&
    !path.includes('#') &&
    !path.includes('\\') &&
    ![...path].some((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127
    })
  )
}

function usesLegacyPreviewPathBuilder(config: ResolvedPublishedPathConfig): boolean {
  const hasNewTemplate =
    Boolean(config.path) || Boolean(config.paths && Object.keys(config.paths).length > 0)
  if (hasNewTemplate) return false
  if (!config.routes || Object.keys(config.routes).length === 0) return false
  return Object.keys(config.localePrefix).length === 0
}

export function buildPublishedPath(
  config: ResolvedPublishedPathConfig,
  data: Record<string, unknown>,
  locale: unknown
): string | null {
  if (typeof config.getPath === 'function') {
    const path = (
      config.getPath as (args: { doc: Record<string, unknown>; locale: unknown }) => unknown
    )({ doc: data, locale })
    if (path === null) return null
    if (typeof path !== 'string') {
      throw new Error('getPath must return a path or null')
    }
    const code = localeCode(locale)
    if (!code) return null
    const prefix = resolveLocaleRoutePrefix(config.localePrefix, code)
    if (prefix === null) return null
    const result = joinPrefixAndPath(prefix, path)
    return isSiteRelativePath(result) ? result : null
  }

  if (usesLegacyPreviewPathBuilder(config)) {
    if (!config.routes) throw new Error('Legacy preview path requires locale routes')
    return buildPreviewPath(config.routes, data, locale, config.params)
  }

  const code = localeCode(locale)
  if (!code) return null

  const pattern = resolvePathTemplate(config, locale)
  if (!pattern) return null

  const resolved = applyDynamicSegments(pattern, data, locale, config.params)
  if (resolved === null) return null

  const prefix = resolveLocaleRoutePrefix(config.localePrefix, code)
  if (prefix === null) return null

  const result = joinPrefixAndPath(prefix, resolved)
  return isSiteRelativePath(result) ? result : null
}

export function resolvePublishedPathConfig(
  pluginLocalePrefix?: LocalePrefix,
  link?: PublishedLinkPathTemplate & { localePrefix?: LocalePrefix }
): ResolvedPublishedPathConfig | null {
  if (!link) return null
  const hasRoutes =
    link.routes && typeof link.routes === 'object' && Object.keys(link.routes).length > 0
  const hasPath = typeof link.path === 'string' && link.path.length > 0
  const hasPaths = link.paths && Object.keys(link.paths).length > 0
  if (!hasRoutes && !hasPath && !hasPaths && typeof link.getPath !== 'function') return null

  return {
    localePrefix: mergeLocalePrefix(pluginLocalePrefix, link.localePrefix),
    path: link.path,
    paths: link.paths,
    routes: hasRoutes ? link.routes : undefined,
    params: link.params,
    getPath: link.getPath,
  }
}
