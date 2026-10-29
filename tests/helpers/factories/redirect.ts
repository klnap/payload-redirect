import type { Payload } from 'payload'
import type { RedirectStatusCode } from '#redirect/core/redirects/model/status-code'

export const createManualRedirect = async (
  payload: Payload,
  data: {
    from: string
    to?: string
    StatusCode?: RedirectStatusCode
    enabled?: boolean
  },
  collection = 'redirects'
) => {
  return payload.create({
    collection,
    data: {
      StatusCode: 301,
      enabled: true,
      ...data,
    },
    overrideAccess: true,
  })
}
