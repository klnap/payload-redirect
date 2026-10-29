import { identifierValueToString } from '#redirect/core/redirects/auto/publication/identifier-transitions'
import { readIdentifierAtPath } from '#redirect/core/redirects/identifier-field-path'
import { normalizePathOrUrl } from '#redirect/core/redirects/normalize-path'

export const normalizeIdentifierValue = (value: string): string => {
  if (value.startsWith('/') || /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)) {
    return normalizePathOrUrl(value)
  }
  return value
}

export const extractIdentifierFromVersionSnapshot = (
  doc: Record<string, unknown>,
  identifier: string,
  locale: string,
  localized: boolean,
  contextLocale?: string
): string | undefined => {
  if (localized && !identifier.includes('.')) {
    const field = doc[identifier]
    if (typeof field === 'string') {
      if (contextLocale !== undefined && contextLocale !== locale) {
        return undefined
      }
      const raw = identifierValueToString(field)
      if (!raw) return undefined
      return normalizeIdentifierValue(raw)
    }
  }

  const raw = readIdentifierAtPath(doc, identifier, locale, localized)
  if (!raw) return undefined
  return normalizeIdentifierValue(raw)
}
