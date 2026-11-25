export const REDIRECT_ORIGIN_VALUES = ['manual', 'auto'] as const

export type RedirectOrigin = (typeof REDIRECT_ORIGIN_VALUES)[number]

export const DEFAULT_REDIRECT_ORIGIN: RedirectOrigin = 'manual'

export const isRedirectOrigin = (value: unknown): value is RedirectOrigin =>
  typeof value === 'string' && (REDIRECT_ORIGIN_VALUES as readonly string[]).includes(value)
