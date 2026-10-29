import type { Config } from 'payload'
import type { LocalePrefix } from '#redirect/core/url/published-path'

export const PAYLOAD_REDIRECT_CUSTOM_KEY = 'payloadRedirect'

export type PayloadRedirectRuntime = {
  collectionSlug: string
  localePrefix?: LocalePrefix
}

type PayloadRedirectConfigCustom = {
  payloadRedirect?: PayloadRedirectRuntime
}

export const registerRedirectRuntime = (
  config: Config,
  runtime: PayloadRedirectRuntime
): Config['custom'] => ({
  ...(config.custom ?? {}),
  [PAYLOAD_REDIRECT_CUSTOM_KEY]: runtime,
})

export const getRedirectRuntime = (config: Pick<Config, 'custom'>): PayloadRedirectRuntime => {
  const custom = config.custom as PayloadRedirectConfigCustom | undefined
  const runtime = custom?.[PAYLOAD_REDIRECT_CUSTOM_KEY]
  if (!runtime?.collectionSlug) {
    throw new Error('payload-redirect: plugin runtime missing — add redirects() to payload config')
  }
  return runtime
}
