import type { CollectionBeforeChangeHook } from 'payload'
import { isInternalRedirectWrite } from './access.js'

export const createRedirectOriginBeforeChange = (): CollectionBeforeChangeHook => async (args) => {
  const { data, operation, req } = args

  if (isInternalRedirectWrite(req)) {
    data.origin = 'auto'
  } else if (operation === 'create') {
    data.origin = 'manual'
  } else {
    data.origin =
      args.originalDoc?.origin === 'auto' ? 'manual' : (args.originalDoc?.origin ?? 'manual')
  }

  return data
}
