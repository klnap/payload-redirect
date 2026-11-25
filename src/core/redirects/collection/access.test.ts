import { describe, expect, it } from 'bun:test'
import type { PayloadRequest } from 'payload'

import { defaultRedirectAccess } from '#redirect/core/redirects/collection/access'
import { REDIRECT_CONTEXT_KEYS } from '#redirect/core/redirects/context-keys'

const anonymous = { user: null, context: {} } as unknown as PayloadRequest
const signedIn = { user: { id: 1 }, context: {} } as unknown as PayloadRequest
const internal = {
  user: null,
  context: { [REDIRECT_CONTEXT_KEYS.internal]: true },
} as unknown as PayloadRequest

const run = (access: (args: { req: PayloadRequest }) => unknown, req: PayloadRequest) =>
  access({ req } as never)

describe('default redirect access', () => {
  it('reads are public, including anonymous requests', () => {
    expect(run(defaultRedirectAccess.read, anonymous)).toBe(true)
  })

  it('create and update need a user or the internal context', () => {
    expect(run(defaultRedirectAccess.create, anonymous)).toBe(false)
    expect(run(defaultRedirectAccess.create, signedIn)).toBe(true)
    expect(run(defaultRedirectAccess.create, internal)).toBe(true)
    expect(run(defaultRedirectAccess.update, anonymous)).toBe(false)
    expect(run(defaultRedirectAccess.update, internal)).toBe(true)
  })

  it('delete needs a user; the internal context does not grant it', () => {
    expect(run(defaultRedirectAccess.delete, anonymous)).toBe(false)
    expect(run(defaultRedirectAccess.delete, internal)).toBe(false)
    expect(run(defaultRedirectAccess.delete, signedIn)).toBe(true)
  })
})
