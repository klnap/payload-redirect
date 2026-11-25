import type { Field, Validate } from 'payload'
import {
  DEFAULT_REDIRECT_ORIGIN,
  isRedirectOrigin,
  REDIRECT_ORIGIN_VALUES,
} from '#redirect/core/redirects/model/origin'
import {
  assertRedirectStatusCode,
  DEFAULT_REDIRECT_STATUS_CODE,
  validateDestinationForStatus,
} from '#redirect/core/redirects/model/status-code'
import { normalizeRedirectSourcePath, normalizeRelativeRedirectPath } from '../normalize-path.js'

const publicFieldRead = { read: () => true } as const

const normalizeSiblingFrom = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  try {
    return normalizeRedirectSourcePath(value)
  } catch {
    return undefined
  }
}

export const buildRedirectFields = (): Field[] => [
  {
    name: 'from',
    type: 'text',
    required: true,
    unique: true,
    access: publicFieldRead,
    validate: (value: unknown) => {
      if (typeof value !== 'string') return 'from is required'
      if (!value.trim()) return 'from is required'
      try {
        normalizeRedirectSourcePath(value)
        return true
      } catch (error) {
        return error instanceof Error ? error.message : 'Invalid from path'
      }
    },
  },
  {
    name: 'to',
    type: 'text',
    required: true,
    access: publicFieldRead,
    validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) => {
      try {
        const statusCode = assertRedirectStatusCode(
          siblingData?.StatusCode ?? DEFAULT_REDIRECT_STATUS_CODE
        )
        validateDestinationForStatus(statusCode, value)
        if (
          typeof value === 'string' &&
          normalizeRelativeRedirectPath(value) === normalizeSiblingFrom(siblingData?.from)
        ) {
          return 'to must differ from from'
        }
        return true
      } catch (error) {
        return error instanceof Error ? error.message : 'Invalid to path'
      }
    },
  },
  {
    name: 'StatusCode',
    type: 'select',
    label: 'Type',
    defaultValue: String(DEFAULT_REDIRECT_STATUS_CODE),
    required: true,
    access: publicFieldRead,
    options: [
      { label: 'Permanent', value: '301' },
      { label: 'Temporary', value: '302' },
    ],
    validate: (value: unknown) => {
      try {
        assertRedirectStatusCode(value)
        return true
      } catch (error) {
        return error instanceof Error ? error.message : 'Invalid StatusCode'
      }
    },
    admin: { position: 'sidebar' },
  },
  {
    name: 'enabled',
    type: 'checkbox',
    defaultValue: true,
    index: true,
    access: publicFieldRead,
    admin: { position: 'sidebar' },
  },
  {
    name: 'origin',
    type: 'select',
    required: true,
    defaultValue: DEFAULT_REDIRECT_ORIGIN,
    access: publicFieldRead,
    options: [
      { label: 'Manual', value: 'manual' },
      { label: 'Auto', value: 'auto' },
    ],
    validate: (value: unknown) =>
      isRedirectOrigin(value) ? true : `origin must be ${REDIRECT_ORIGIN_VALUES.join(' or ')}`,
    admin: { position: 'sidebar', readOnly: true },
  },
]

export const mergeRedirectFields = (existingFields: Field[]): Field[] => {
  const defaults = buildRedirectFields()
  const existingByName = new Map(
    existingFields
      .filter(
        (field): field is Field & { name: string } =>
          'name' in field && typeof field.name === 'string'
      )
      .map((field) => [field.name, field])
  )
  const defaultNames = new Set(
    defaults
      .filter(
        (field): field is Field & { name: string } =>
          'name' in field && typeof field.name === 'string'
      )
      .map((field) => field.name)
  )
  const merged = defaults.map((field) => {
    if (!('name' in field) || typeof field.name !== 'string') return field
    const override = existingByName.get(field.name)
    if (!override) return field
    const validate =
      'validate' in field && typeof field.validate === 'function' ? field.validate : undefined
    const overrideValidate =
      'validate' in override && typeof override.validate === 'function'
        ? override.validate
        : undefined
    return {
      ...field,
      ...override,
      ...(validate
        ? {
            validate: async (value: unknown, options: Parameters<Validate>[1]) => {
              const run = validate as Validate
              const result = await run(value, options)
              return result === true && overrideValidate
                ? (overrideValidate as Validate)(value, options)
                : result
            },
          }
        : {}),
    } as Field
  })

  return [
    ...merged,
    ...existingFields.filter(
      (field) =>
        !('name' in field) || typeof field.name !== 'string' || !defaultNames.has(field.name)
    ),
  ]
}

export const assertRedirectFields = (fields: Field[]): void => {
  const expected = new Map([
    ['from', 'text'],
    ['to', 'text'],
    ['StatusCode', 'select'],
    ['enabled', 'checkbox'],
    ['origin', 'select'],
  ])
  const named = fields.filter(
    (field): field is Field & { name: string } => 'name' in field && typeof field.name === 'string'
  )

  for (const [name, type] of expected) {
    const matching = named.filter((field) => field.name === name)
    if (matching.length !== 1 || !('type' in matching[0]!) || matching[0]!.type !== type) {
      throw new Error(
        `payload-redirect: overrides.fields must retain exactly one ${type} field named "${name}"`
      )
    }
  }

  const from = named.find((field) => field.name === 'from')
  const enabled = named.find((field) => field.name === 'enabled')
  if (!from || !('unique' in from) || from.unique !== true) {
    throw new Error('payload-redirect: overrides.fields must keep from.unique: true')
  }
  if (!enabled || !('index' in enabled) || enabled.index !== true) {
    throw new Error('payload-redirect: overrides.fields must keep enabled.index: true')
  }
}
