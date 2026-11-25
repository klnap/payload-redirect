import {
  assertRedirectStatusCode,
  DEFAULT_REDIRECT_STATUS_CODE,
} from '#redirect/core/redirects/model/status-code'
import type { RedirectLookupDoc } from '#redirect/core/redirects/queries'

export const isIdenticalAutoRule = (
  doc: RedirectLookupDoc,
  rule: { from: string; to: string }
): boolean =>
  doc.from === rule.from &&
  doc.to === rule.to &&
  assertRedirectStatusCode(doc.StatusCode ?? DEFAULT_REDIRECT_STATUS_CODE) ===
    DEFAULT_REDIRECT_STATUS_CODE &&
  doc.enabled !== false &&
  doc.origin === 'auto'
