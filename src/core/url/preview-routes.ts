import { localeCode } from './preview-path'
import { applyDynamicSegments, type RouteParamsConfig } from './route-params'

export type PreviewRoutes = Record<string, string | Record<string, string>>

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

export function buildPreviewPath(
  previewRoutes: PreviewRoutes,
  data: Record<string, unknown>,
  locale: unknown,
  routeParams?: RouteParamsConfig
): string | null {
  const code = localeCode(locale)
  if (!code) return null

  const pattern = patternForLocale(previewRoutes, locale)
  if (!pattern) return null

  const resolved = applyDynamicSegments(pattern, data, locale, routeParams)
  if (resolved === null) return null

  if (resolved === '/' || resolved === '') return `/${code}`

  return `/${code}${resolved.startsWith('/') ? resolved : `/${resolved}`}`
}
