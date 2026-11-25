import type { Access, PayloadRequest } from 'payload'
import { REDIRECT_CONTEXT_KEYS } from '#redirect/core/redirects/context-keys'

export const isInternalRedirectWrite = (req: PayloadRequest): boolean =>
  Boolean(req.context?.[REDIRECT_CONTEXT_KEYS.internal])

const isHumanUser = (req: PayloadRequest): boolean =>
  Boolean(req.user) && (req.user as { type?: string }).type !== 'service'

export const defaultRedirectAccess = {
  read: (() => true) as Access,
  create: (({ req }) => isInternalRedirectWrite(req) || isHumanUser(req)) as Access,
  update: (({ req }) => isInternalRedirectWrite(req) || isHumanUser(req)) as Access,
  delete: (({ req }) => isHumanUser(req)) as Access,
}
