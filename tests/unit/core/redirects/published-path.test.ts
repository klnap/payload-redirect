import { describe, expect, it } from 'bun:test'
import type { CollectionConfig } from 'payload'
import { resolveCollectionPublishedPathConfig } from '#redirect/core/redirects/auto/published-path'

describe('resolveCollectionPublishedPathConfig', () => {
  it('merges plugin localePrefix with collection path template', () => {
    const collection: CollectionConfig = {
      slug: 'projects',
      fields: [],
      custom: {
        redirect: {
          identifier: 'slug',
          publishedLink: {
            path: '/projects/[slug]',
            paths: { pl: '/projekty/[slug]' },
            params: { slug: { field: 'slug', localized: true } },
          },
        },
      },
    }

    const config = resolveCollectionPublishedPathConfig(collection, {
      en: '',
      pl: '/pl',
    })

    expect(config?.path).toBe('/projects/[slug]')
    expect(config?.localePrefix.pl).toBe('/pl')
  })
})
