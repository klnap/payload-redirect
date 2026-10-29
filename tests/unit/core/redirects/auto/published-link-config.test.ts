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
})
