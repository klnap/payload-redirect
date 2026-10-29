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

export const redirectCreateAccess: Access = ({ req }) => {
  if (isRedirectInternalRequest(req)) return true
  return Boolean(req.user)
}

export const redirectUpdateAccess: Access = ({ req }) => {
  if (isRedirectInternalRequest(req)) return true
  return Boolean(req.user)
}

export const redirectDeleteAccess: Access = ({ req }) => Boolean(req.user)

export const mergeRedirectsAccess = (
  base: RedirectsCollectionAccess | undefined,
  overrides: RedirectsCollectionAccess | undefined
): RedirectsCollectionAccess => ({
  read: base?.read ?? overrides?.read ?? redirectReadAccess,
  create: base?.create ?? overrides?.create ?? redirectCreateAccess,
  update: base?.update ?? overrides?.update ?? redirectUpdateAccess,
  delete: base?.delete ?? overrides?.delete ?? redirectDeleteAccess,
})
