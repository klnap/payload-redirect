import type { CollectionBeforeChangeHook } from 'payload'
import { REDIRECT_CONTEXT_KEYS } from '#redirect/core/redirects/context-keys'
import { DEFAULT_REDIRECT_ORIGIN } from '#redirect/core/redirects/model/origin'

export const createRedirectOriginBeforeChange = (): CollectionBeforeChangeHook => async (args) => {
  const { data, operation, req } = args

  if (req.context?.[REDIRECT_CONTEXT_KEYS.internal]) {
    if (data.origin !== 'auto') {
      data.origin = 'auto'
    }
    return data
  }

  // Origin is server-owned: a non-internal write can never set or keep 'auto'.
  if (operation === 'create') {
    data.origin = DEFAULT_REDIRECT_ORIGIN
  }

  if (operation === 'update') {
    data.origin =
      args.originalDoc?.origin === 'auto'
        ? 'manual'
        : (args.originalDoc?.origin ?? DEFAULT_REDIRECT_ORIGIN)
  }

  return data
}
