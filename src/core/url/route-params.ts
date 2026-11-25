const DYNAMIC_SEGMENT = /\[([^\]]+)\]/g
const VALID_FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const FORBIDDEN_FIELD_NAMES = new Set(['__proto__', 'constructor', 'prototype'])

export const hasControlCharacter = (value: string): boolean =>
  [...value].some((character) => {
    const code = character.charCodeAt(0)
    return code <= 0x1f || code === 0x7f
  })

export const isValidPathTemplate = (template: string): boolean => {
  if (
    !template.startsWith('/') ||
    template.startsWith('//') ||
    /[?#\\]/.test(template) ||
    hasControlCharacter(template)
  ) {
    return false
  }

  const fields = [...template.matchAll(DYNAMIC_SEGMENT)]
  if (
    template.replace(DYNAMIC_SEGMENT, '').includes('[') ||
    template.replace(DYNAMIC_SEGMENT, '').includes(']')
  ) {
    return false
  }

  return fields.every(([, name]) =>
    Boolean(name && VALID_FIELD_NAME.test(name) && !FORBIDDEN_FIELD_NAMES.has(name))
  )
}

const extractDynamicSegments = (template: string): string[] =>
  [...template.matchAll(DYNAMIC_SEGMENT)].flatMap(([, name]) => (name ? [name] : []))

export const applyDynamicSegments = (
  template: string,
  doc: Record<string, unknown>,
  locale: string | undefined
): string | null => {
  if (!isValidPathTemplate(template)) return null

  let result = template
  for (const field of extractDynamicSegments(template)) {
    let value = doc[field]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      value = locale ? (value as Record<string, unknown>)[locale] : undefined
    }

    if (typeof value === 'number' && Number.isFinite(value)) value = String(value)
    if (typeof value !== 'string' || !value || value === '.' || value === '..') return null
    result = result.replaceAll(`[${field}]`, encodeURIComponent(value))
  }

  return result
}
