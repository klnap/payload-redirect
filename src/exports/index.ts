export {
  type CreateRedirectOptions,
  createRedirect,
} from '#redirect/core/redirects/auto/create-redirect'
export type { RedirectsCollectionAccess } from '#redirect/core/redirects/collection/access'
export { REDIRECT_CONTEXT_KEYS } from '#redirect/core/redirects/context-keys'
export {
  RedirectAmbiguousRuleError,
  RedirectConfigError,
  RedirectValidationError,
} from '#redirect/core/redirects/model/errors'
export type { RedirectOrigin } from '#redirect/core/redirects/model/origin'
export type { RedirectStatusCode } from '#redirect/core/redirects/model/status-code'
export {
  type ResolveRedirectArgs,
  resolveRedirect,
} from '#redirect/core/redirects/resolution/resolve'
export type { ResolvedRedirect } from '#redirect/core/redirects/resolution/resolved'
export { redirects } from '#redirect/plugin/payload-plugin'
export type { RedirectsPluginConfig } from '#redirect/plugin/resolve-config'
