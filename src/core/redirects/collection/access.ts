import type { Access, PayloadRequest } from 'payload'
import { REDIRECT_CONTEXT_KEYS } from '#redirect/core/redirects/context-keys'

export type RedirectsCollectionAccess = {
  read?: Access
  create?: Access
  update?: Access
  delete?: Access
}

export const isRedirectInternalRequest = (req: PayloadRequest): boolean =>
  Boolean(req.context?.[REDIRECT_CONTEXT_KEYS.internal])

export const redirectReadAccess: Access = () => true

/**
 * Manual redirect rules are human-managed. A service principal (type `service`) is refused, so
 * automation cannot write them unless a host grants it explicitly through its own access override.
 * Automatic rules are written by the package itself under the internal context and are not affected.
 */
const isHumanSignedIn = (req: PayloadRequest): boolean =>
  Boolean(req.user) && (req.user as { type?: string }).type !== 'service'

export const redirectCreateAccess: Access = ({ req }) => {
  if (isRedirectInternalRequest(req)) return true
  return isHumanSignedIn(req)
}

export const redirectUpdateAccess: Access = ({ req }) => {
  if (isRedirectInternalRequest(req)) return true
  return isHumanSignedIn(req)
}

export const redirectDeleteAccess: Access = ({ req }) => isHumanSignedIn(req)

export const mergeRedirectsAccess = (
  base: RedirectsCollectionAccess | undefined,
  overrides: RedirectsCollectionAccess | undefined
): RedirectsCollectionAccess => ({
  read: base?.read ?? overrides?.read ?? redirectReadAccess,
  create: base?.create ?? overrides?.create ?? redirectCreateAccess,
  update: base?.update ?? overrides?.update ?? redirectUpdateAccess,
  delete: base?.delete ?? overrides?.delete ?? redirectDeleteAccess,
})
