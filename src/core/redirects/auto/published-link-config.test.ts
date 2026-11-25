import { describe, expect, it } from 'bun:test'
import { readPublishedLinkWire } from '#redirect/core/redirects/auto/published-link-config'

describe('readPublishedLinkWire', () => {
  it('prefers custom.redirect.publishedLink over draft block', () => {
    const wire = readPublishedLinkWire({
      redirect: {
        identifier: 'slug',
        publishedLink: { path: '/from-redirect/[slug]' },
      },
      draft: {
        publishedLink: { path: '/from-draft/[slug]' },
      },
    })
    expect(wire?.path).toBe('/from-redirect/[slug]')
  })

  it('reads custom.draft.publishedLink when redirect has no link', () => {
    const wire = readPublishedLinkWire({
      draft: {
        publishedLink: { path: '/projects/[slug]' },
      },
    })
    expect(wire?.path).toBe('/projects/[slug]')
  })

  it('reads all supported wire fields and rejects unsupported or disabled shapes', () => {
    const getPath = () => '/custom/path'
    expect(
      readPublishedLinkWire({
        redirect: {
          publishedLink: {
            paths: { en: '/page/[slug]' },
            routes: { '/page/[slug]': { en: '/page/[slug]' } },
            params: { slug: 'slug' },
            localePrefix: { en: '/en' },
            getPath,
          },
        },
      })
    ).toEqual({
      paths: { en: '/page/[slug]' },
      routes: { '/page/[slug]': { en: '/page/[slug]' } },
      params: { slug: 'slug' },
      localePrefix: { en: '/en' },
      getPath,
    })
    expect(readPublishedLinkWire(null)).toBeNull()
    expect(readPublishedLinkWire({ redirect: [] })).toBeNull()
    expect(readPublishedLinkWire({ redirect: { publishedLink: { path: '' } } })).toBeNull()
    expect(
      readPublishedLinkWire({ draft: { enabled: false, publishedLink: { path: '/x' } } })
    ).toBeNull()
    expect(readPublishedLinkWire({ draft: { publishedLink: [] } })).toBeNull()
  })
})
