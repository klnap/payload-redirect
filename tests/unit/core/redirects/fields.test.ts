import { describe, expect, it } from 'bun:test'
import {
  buildRedirectFields,
  mergeRedirectFields,
} from '#redirect/core/redirects/collection/fields'

describe('redirect fields', () => {
  const fields = buildRedirectFields()
  const names = fields.map((f) => ('name' in f ? f.name : ''))

  it('includes plugin-owned fields', () => {
    expect(names).toEqual(['from', 'to', 'StatusCode', 'enabled', 'origin'])
  })

  it('from is unique (Payload postgres adapter creates a unique btree; separate index: true is redundant)', () => {
    const from = fields.find((f) => 'name' in f && f.name === 'from')
    expect(from && 'unique' in from ? from.unique : undefined).toBe(true)
    expect(from && 'index' in from ? from.index : undefined).not.toBe(true)
  })

  it('plugin fields allow public read (sort/where under fail-closed field access hosts)', () => {
    for (const name of ['from', 'to', 'StatusCode', 'enabled', 'origin'] as const) {
      const field = fields.find((f) => 'name' in f && f.name === name)
      expect(field && 'access' in field ? field.access?.read?.({} as never) : undefined).toBe(true)
    }
  })

  it('enabled is indexed for bulk fetch filters', () => {
    const enabled = fields.find((f) => 'name' in f && f.name === 'enabled')
    expect(enabled && 'index' in enabled ? enabled.index : undefined).toBe(true)
  })

  it('StatusCode is a Type select (301/302 stored as strings)', () => {
    const status = fields.find((f) => 'name' in f && f.name === 'StatusCode')
    expect(status && 'type' in status ? status.type : undefined).toBe('select')
    expect(status && 'label' in status ? status.label : undefined).toBe('Type')
    expect(status && 'defaultValue' in status ? status.defaultValue : undefined).toBe('301')
    expect(status && 'options' in status ? status.options : undefined).toEqual([
      { label: 'Permanent', value: '301' },
      { label: 'Temporary', value: '302' },
    ])
  })

  it('origin options are Manual and Auto only', () => {
    const origin = fields.find((f) => 'name' in f && f.name === 'origin')
    expect(origin && 'options' in origin ? origin.options : undefined).toEqual([
      { label: 'Manual', value: 'manual' },
      { label: 'Auto', value: 'auto' },
    ])
    const validate = (
      origin && 'validate' in origin && typeof origin.validate === 'function'
        ? origin.validate
        : undefined
    ) as ((value: unknown, ctx: unknown) => string | true) | undefined
    expect(validate?.('automatic', { siblingData: {} })).toMatch(/manual|auto/)
    expect(validate?.('auto', { siblingData: {} })).toBe(true)
  })

  it('from rejects absolute URLs and host-like paths', () => {
    const from = fields.find((f) => 'name' in f && f.name === 'from')
    const validate = (
      from && 'validate' in from && typeof from.validate === 'function' ? from.validate : undefined
    ) as ((value: unknown, ctx: unknown) => string | true) | undefined
    const ctx = { siblingData: {} }
    expect(validate?.('/ok-path', ctx)).toBe(true)
    expect(validate?.('https://example.com/a', ctx)).toMatch(/site-relative/)
    expect(validate?.('//example.com/a', ctx)).toMatch(/site-relative/)
    expect(validate?.('example.com/a', ctx)).toMatch(/site-relative/)
  })
})

describe('mergeRedirectFields', () => {
  it('places plugin fields first, then host-only fields', () => {
    const merged = mergeRedirectFields([
      { name: 'description', type: 'richText' },
      { name: 'from', type: 'text', unique: true, index: true },
    ])

    expect(merged.map((f) => ('name' in f ? f.name : ''))).toEqual([
      'from',
      'to',
      'StatusCode',
      'enabled',
      'origin',
      'description',
    ])
  })

  it('uses host override at the plugin field position', () => {
    const merged = mergeRedirectFields([
      {
        name: 'StatusCode',
        type: 'select',
        options: [
          { label: 'Permanent', value: '301' },
          { label: 'Temporary', value: '302' },
        ],
        admin: { position: 'sidebar', description: 'custom' },
      },
    ])

    const status = merged.find((f) => 'name' in f && f.name === 'StatusCode')
    expect(
      status && 'admin' in status
        ? (status.admin as { description?: string })?.description
        : undefined
    ).toBe('custom')
    const last = merged.at(-1)
    expect(last && 'name' in last ? last.name : undefined).toBe('origin')
  })
})
