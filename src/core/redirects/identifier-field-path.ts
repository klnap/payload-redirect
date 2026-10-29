export type FieldLike = {
  name?: string
  type?: string
  localized?: boolean
  fields?: FieldLike[]
  tabs?: Array<{ fields?: FieldLike[] }>
}

const containerTypes = new Set(['group', 'row', 'collapsible', 'array'])

const identifierValueToString = (value: unknown): string | undefined => {
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

function flattenFields(fields: FieldLike[]): FieldLike[] {
  const out: FieldLike[] = []
  for (const field of fields) {
    if (field.type === 'tabs' && field.tabs) {
      for (const tab of field.tabs) {
        if (tab.fields) out.push(...flattenFields(tab.fields))
      }
      continue
    }
    if (field.type === 'row' && field.fields) {
      out.push(...flattenFields(field.fields))
      continue
    }
    out.push(field)
    if (field.type && containerTypes.has(field.type) && field.fields) {
      out.push(...flattenFields(field.fields))
    }
  }
  return out
}

function resolveFieldAtPath(fields: FieldLike[], path: string): FieldLike | undefined {
  const segments = path.split('.').filter(Boolean)
  if (segments.length === 0) return undefined

  let currentFields = flattenFields(fields)
  let resolved: FieldLike | undefined

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    resolved = currentFields.find((f) => f.name === segment)
    if (!resolved) return undefined
    if (i < segments.length - 1) {
      if (!resolved.fields?.length) return undefined
      currentFields = flattenFields(resolved.fields)
    }
  }

  return resolved
}

export function isIdentifierPathLocalized(fields: FieldLike[], path: string): boolean {
  const field = resolveFieldAtPath(fields, path)
  return Boolean(field?.localized)
}

function readValueAtPath(doc: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.').filter(Boolean)
  let current: unknown = doc
  for (const segment of segments) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

/** Read identifier string from doc; honors localized maps on the leaf (or intermediate) value. */
export function readIdentifierAtPath(
  doc: Record<string, unknown>,
  path: string,
  locale: string,
  localizedField: boolean
): string | undefined {
  if (!localizedField) {
    return identifierValueToString(readValueAtPath(doc, path))
  }

  const segments = path.split('.').filter(Boolean)
  if (segments.length === 0) return undefined

  let current: unknown = doc
  for (let i = 0; i < segments.length; i++) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
    current = (current as Record<string, unknown>)[segments[i]!]
  }

  if (current && typeof current === 'object' && !Array.isArray(current)) {
    return identifierValueToString((current as Record<string, unknown>)[locale])
  }

  return identifierValueToString(current)
}

/** Last segment of a field path — used for publishedLink param keys. */
export function paramKeyFromIdentifierPath(path: string): string {
  const segments = path.split('.').filter(Boolean)
  return segments[segments.length - 1] ?? path
}
