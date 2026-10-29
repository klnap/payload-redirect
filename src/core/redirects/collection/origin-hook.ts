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

  if (operation === 'create') {
    data.origin = DEFAULT_REDIRECT_ORIGIN
  }

  if (operation === 'update' && args.originalDoc?.origin === 'auto') {
    data.origin = 'manual'
  }

  return data
}
