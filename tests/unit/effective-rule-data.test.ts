import { describe, expect, test } from 'bun:test'
import { effectiveRuleData } from '#redirect/core/redirects/collection/duplicate-guard'

describe('effectiveRuleData', () => {
  const stored = { id: 'r1', from: '/a', to: '/b', enabled: false, StatusCode: 301 }

  test('create uses the incoming data unchanged', () => {
    const data = { from: '/x', to: '/y' }
    expect(effectiveRuleData('create', data, null)).toBe(data)
  })

  test('update overlays the incoming change on the stored rule', () => {
    expect(effectiveRuleData('update', { enabled: true }, stored)).toEqual({
      ...stored,
      enabled: true,
    })
  })

  test('update with no incoming data stays undefined', () => {
    expect(effectiveRuleData('update', undefined, stored)).toBeUndefined()
  })
})
