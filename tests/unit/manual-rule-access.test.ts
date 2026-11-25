import { describe, expect, test } from 'bun:test'
import {
  mergeRedirectsAccess,
  redirectCreateAccess,
  redirectDeleteAccess,
  redirectUpdateAccess,
} from '#redirect/core/redirects/collection/access'
import { REDIRECT_CONTEXT_KEYS } from '#redirect/core/redirects/context-keys'

const human = { user: { id: 'u1', type: 'human' } }
const service = { user: { id: 's1', type: 'service' } }
const internal = { user: undefined, context: { [REDIRECT_CONTEXT_KEYS.internal]: true } }
const anonymous = { user: undefined }

const access = (fn: typeof redirectCreateAccess, reqPart: Record<string, unknown>) =>
  (fn as unknown as (a: { req: unknown }) => boolean)({ req: reqPart })

describe('manual redirect write access', () => {
  test('human staff may create, update and delete manual rules', () => {
    expect(access(redirectCreateAccess, human)).toBe(true)
    expect(access(redirectUpdateAccess, human)).toBe(true)
    expect(access(redirectDeleteAccess, human)).toBe(true)
  })

  test('a service principal is refused for create, update and delete', () => {
    expect(access(redirectCreateAccess, service)).toBe(false)
    expect(access(redirectUpdateAccess, service)).toBe(false)
    expect(access(redirectDeleteAccess, service)).toBe(false)
  })

  test('anonymous requests are refused', () => {
    expect(access(redirectCreateAccess, anonymous)).toBe(false)
    expect(access(redirectDeleteAccess, anonymous)).toBe(false)
  })

  test('package-internal automatic writes are still allowed', () => {
    expect(access(redirectCreateAccess, internal)).toBe(true)
    expect(access(redirectUpdateAccess, internal)).toBe(true)
  })
})

describe('explicit host grant for service principals', () => {
  const serviceGrant = (args: { req: unknown }) =>
    (args.req as { user?: { type?: string } }).user?.type === 'service'

  test('the default denies service principals on every manual write', () => {
    const access = mergeRedirectsAccess(undefined, undefined)
    expect((access.create as never as (a: unknown) => boolean)({ req: service })).toBe(false)
    expect((access.update as never as (a: unknown) => boolean)({ req: service })).toBe(false)
    expect((access.delete as never as (a: unknown) => boolean)({ req: service })).toBe(false)
  })

  test('a host override is honored for the operation it names, and only that one', () => {
    const access = mergeRedirectsAccess(undefined, { create: serviceGrant as never })
    expect((access.create as never as (a: unknown) => boolean)({ req: service })).toBe(true)
    expect((access.update as never as (a: unknown) => boolean)({ req: service })).toBe(false)
    expect((access.delete as never as (a: unknown) => boolean)({ req: service })).toBe(false)
  })

  test('a host override does not change human access', () => {
    const access = mergeRedirectsAccess(undefined, { create: () => false })
    expect((access.create as never as (a: unknown) => boolean)({ req: human })).toBe(false)
    expect((redirectUpdateAccess as never as (a: unknown) => boolean)({ req: human })).toBe(true)
  })
})
