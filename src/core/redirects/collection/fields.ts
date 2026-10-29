import type { Field } from 'payload'
import { RedirectValidationError } from '#redirect/core/redirects/model/errors'
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
import { normalizeRelativeRedirectPath } from '#redirect/core/redirects/normalize-path'

/**
 * Matches collection `read: () => true`. Required under hosts that wrap field
 * access fail-closed (e.g. host IAM plugins): Payload validates sort/where
 * against field read, and `defaultSort: 'from'` always queries these paths.
 */
const publicFieldRead = { read: () => true } as const

export const buildRedirectFields = (): Field[] => [
  {
    name: 'from',
    type: 'text',
    required: true,
    unique: true,
    access: publicFieldRead,
    validate: (value: unknown) => {
      if (typeof value !== 'string' || value.trim().length === 0) {
        return 'from is required'
      }
      try {
        normalizeRelativeRedirectPath(value)
        return true
      } catch (error) {
        return error instanceof RedirectValidationError ? error.message : 'Invalid from path'
      }
    },
  },
  {
    name: 'to',
    type: 'text',
    access: publicFieldRead,
    validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) => {
      try {
        const code = assertRedirectStatusCode(
          siblingData?.StatusCode ?? DEFAULT_REDIRECT_STATUS_CODE
        )
        validateDestinationForStatus(code, value)
        if (typeof value === 'string' && value.trim().length > 0) {
          normalizeRelativeRedirectPath(value)
        }
        return true
      } catch (error) {
        return error instanceof RedirectValidationError ? error.message : 'Invalid to path'
      }
    },
  },
  {
    name: 'StatusCode',
    type: 'select',
    label: 'Type',
    defaultValue: '301',
    required: true,
    access: publicFieldRead,
    options: [
      { label: 'Permanent', value: '301' },
      { label: 'Temporary', value: '302' },
    ],
    admin: {
      position: 'sidebar',
    },
  },
  {
    name: 'enabled',
    type: 'checkbox',
    defaultValue: true,
    index: true,
    access: publicFieldRead,
    admin: {
      position: 'sidebar',
    },
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
    admin: {
      position: 'sidebar',
      readOnly: true,
    },
    validate: (value: unknown) => {
      if (!isRedirectOrigin(value)) {
        return `origin must be ${REDIRECT_ORIGIN_VALUES.join(' or ')}`
      }
      return true
    },
  },
]

export const mergeRedirectFields = (existingFields: Field[]): Field[] => {
  const built = buildRedirectFields()
  const hostByName = new Map(
    existingFields
      .filter((f): f is Field & { name: string } => 'name' in f && typeof f.name === 'string')
      .map((field) => [field.name, field])
  )

  const pluginNames = new Set(
    built
      .filter((f): f is Field & { name: string } => 'name' in f && typeof f.name === 'string')
      .map((field) => field.name)
  )

  const merged: Field[] = []
  for (const field of built) {
    const name = 'name' in field && typeof field.name === 'string' ? field.name : ''
    if (!name) continue
    merged.push(hostByName.get(name) ?? field)
  }

  for (const field of existingFields) {
    const name = 'name' in field && typeof field.name === 'string' ? field.name : ''
    if (name && pluginNames.has(name)) continue
    merged.push(field)
  }

  return merged
}
