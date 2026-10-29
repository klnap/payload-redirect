import type { RedirectStatusCode } from '#redirect/core/redirects/model/status-code'
import { assertRedirectStatusCode } from '#redirect/core/redirects/model/status-code'

export type ResolvedRedirect = { statusCode: 301 | 302; to: string } | null

export type RedirectRecordShape = {
  from: string
  to?: string | null
  StatusCode: RedirectStatusCode
  enabled: boolean
}

export const toResolvedRedirect = (record: RedirectRecordShape): ResolvedRedirect | null => {
  if (!record.enabled) return null

  let code: RedirectStatusCode
  try {
    code = assertRedirectStatusCode(record.StatusCode)
  } catch {
    return null
  }

  const to = record.to
  if (typeof to !== 'string' || to.trim().length === 0) {
    return null
  }
  return { statusCode: code, to: to.trim() }
}

export const redirectLogicalIdentity = (record: {
  from: string
  to?: string | null
  StatusCode: RedirectStatusCode
}): string => `${record.from}\0${record.to ?? ''}\0${record.StatusCode}`
