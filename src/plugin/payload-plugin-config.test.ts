import { describe, expect, it } from 'bun:test'
import type { Config } from 'payload'
import { redirects } from '#redirect/plugin/payload-plugin'

describe('redirects plugin config transform', () => {
  it('adds its owned redirects collection and registers the runtime slug', () => {
    const config = redirects()({
      collections: [{ slug: 'pages', fields: [] }],
    } as unknown as Config) as Config

    expect(config.collections?.map(({ slug }) => slug)).toEqual(['pages', 'redirects'])
    expect(
      (config.custom as { payloadRedirect?: { collectionSlug: string; localePrefix?: unknown } })
        .payloadRedirect
    ).toEqual({ collectionSlug: 'redirects', localePrefix: undefined })
  })

  it('wires declarative collections without replacing existing hooks', () => {
    const existingHook = () => undefined
    const config = redirects()({
      collections: [
        {
          slug: 'pages',
          fields: [],
          hooks: { afterChange: [existingHook] },
          custom: { redirect: { identifier: 'slug' } },
        },
      ],
    } as unknown as Config) as Config
    const page = config.collections?.[0]

    expect(page?.hooks?.afterChange).toHaveLength(2)
    expect(page?.hooks?.afterChange?.[0]).toBe(existingHook)
  })

  it('supports native collection overrides and rejects slug collisions', () => {
    const config = redirects({
      overrides: { slug: 'url-rules', labels: { singular: 'URL rule', plural: 'URL rules' } },
    })({ collections: [] } as unknown as Config) as Config
    expect(config.collections?.[0]?.slug).toBe('url-rules')

    expect(() =>
      redirects()({ collections: [{ slug: 'redirects', fields: [] }] } as unknown as Config)
    ).toThrow(/already registered/)
  })

  it('merges central path configuration and validates locale maps', () => {
    const config = redirects({
      localePrefix: { en: '', pl: '/pl' },
      collections: {
        articles: {
          identifier: 'slug',
          paths: { en: '/pages/[slug]', pl: '/strony/[slug]' },
        },
      } as never,
    })({
      localization: { locales: ['en', 'pl'], defaultLocale: 'en' },
      collections: [
        {
          slug: 'articles',
          fields: [{ name: 'slug', type: 'text' }],
          custom: { redirect: { identifier: 'slug' } },
        },
      ],
    } as unknown as Config) as Config
    const redirect = config.collections?.[0]?.custom as {
      redirect?: { publishedLink?: { paths?: Record<string, string> } }
    }
    expect(redirect.redirect?.publishedLink?.paths).toEqual({
      en: '/pages/[slug]',
      pl: '/strony/[slug]',
    })

    expect(() =>
      redirects({
        collections: {
          articles: { identifier: 'slug', paths: { en: '/pages/[slug]' } },
        } as never,
      })({
        localization: { locales: ['en', 'pl'], defaultLocale: 'en' },
        collections: [{ slug: 'articles', fields: [] }],
      } as unknown as Config)
    ).toThrow(/missing: pl/)
  })

  it('rejects duplicate installation', () => {
    const plugin = redirects()
    expect(() =>
      plugin({ collections: [], plugins: [plugin, redirects()] } as unknown as Config)
    ).toThrow(/only once/)
  })

  it('does not overwrite the reserved runtime namespace', () => {
    expect(() =>
      redirects()({
        collections: [],
        custom: { payloadRedirect: { hostValue: true } },
      } as unknown as Config)
    ).toThrow(/config\.custom\.payloadRedirect is reserved/)
  })
})
