import { describe, expect, it } from 'bun:test'
import { resolveDuplicateGuardExcludeId } from '#redirect/core/redirects/collection/duplicate-guard'

describe('resolveDuplicateGuardExcludeId', () => {
  it('returns undefined on create', () => {
    expect(resolveDuplicateGuardExcludeId('create', { id: 'abc' })).toBeUndefined()
  })

  it('returns originalDoc id on update', () => {
    expect(
      resolveDuplicateGuardExcludeId('update', { id: 'd48e2f36-f45b-4322-8065-d51d436d6436' })
    ).toBe('d48e2f36-f45b-4322-8065-d51d436d6436')
    expect(resolveDuplicateGuardExcludeId('update', { id: 42 })).toBe(42)
  })

  it('returns undefined on update without originalDoc or id', () => {
    expect(resolveDuplicateGuardExcludeId('update', undefined)).toBeUndefined()
    expect(resolveDuplicateGuardExcludeId('update', {})).toBeUndefined()
  })
})
