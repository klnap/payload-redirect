import { describe, expect, it } from 'bun:test'
import type { PayloadRequest } from 'payload'

import {
  mergeRedirectsAccess,
  redirectCreateAccess,
  redirectDeleteAccess,
  redirectReadAccess,
  redirectUpdateAccess,
} from '#redirect/core/redirects/collection/access'
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
    expect(run(redirectReadAccess, anonymous)).toBe(true)
  })

  it('create and update need a user or the internal context', () => {
    expect(run(redirectCreateAccess, anonymous)).toBe(false)
    expect(run(redirectCreateAccess, signedIn)).toBe(true)
    expect(run(redirectCreateAccess, internal)).toBe(true)
    expect(run(redirectUpdateAccess, anonymous)).toBe(false)
    expect(run(redirectUpdateAccess, internal)).toBe(true)
  })

  it('delete needs a user; the internal context does not grant it', () => {
    expect(run(redirectDeleteAccess, anonymous)).toBe(false)
    expect(run(redirectDeleteAccess, internal)).toBe(false)
    expect(run(redirectDeleteAccess, signedIn)).toBe(true)
  })

  it('host handlers win over plugin overrides, which win over defaults', () => {
    const hostRead = () => false
    const pluginRead = () => true
    const merged = mergeRedirectsAccess({ read: hostRead }, { read: pluginRead })
    expect(merged.read).toBe(hostRead)
    expect(mergeRedirectsAccess(undefined, { read: pluginRead }).read).toBe(pluginRead)
    expect(mergeRedirectsAccess(undefined, undefined).read).toBe(redirectReadAccess)
  })
})
