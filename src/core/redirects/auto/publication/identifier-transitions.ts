export type IdentifierTransition = {
  locale?: string
  previous: string
  current: string
}

export const identifierValueToString = (value: unknown): string | undefined => {
  if (value == null) return undefined
  if (typeof value === 'string') {
    const t = value.trim()
    return t.length > 0 ? t : undefined
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return undefined
}

/**
 * Compare previous/current per locale without cross-locale fallback.
 */
export const collectLocalizedIdentifierTransitions = (args: {
  locales: string[]
  previousByLocale: Record<string, string | undefined>
  currentByLocale: Record<string, string | undefined>
}): IdentifierTransition[] => {
  const out: IdentifierTransition[] = []
  for (const locale of args.locales) {
    const previous = args.previousByLocale[locale]
    const current = args.currentByLocale[locale]
    if (!previous || !current) continue
    if (previous === current) continue
    out.push({ locale, previous, current })
  }
  return out
}

export const collectScalarIdentifierTransition = (args: {
  previous?: string
  current?: string
}): IdentifierTransition | undefined => {
  const { previous, current } = args
  if (!previous || !current) return undefined
  if (previous === current) return undefined
  return { previous, current }
}
