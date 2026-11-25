import {
  type RedirectOrigin,
  type RedirectStatusCode,
  type RedirectsOptions,
  redirects,
} from '@klnap/payload-redirect'

declare module 'payload' {
  interface GeneratedTypes {
    collections: {
      articles: {
        id: string
        slug: string
        title: string
      }
      redirects: {
        id: string
        from: string
        to: string
        StatusCode: '301' | '302'
        enabled: boolean
        origin: 'manual' | 'auto'
      }
    }
    locale: 'en' | 'pl'
  }
}

redirects({
  localePrefix: { en: '', pl: '/pl' },
  collections: {
    articles: {
      identifier: 'slug',
      getPath: ({ doc, locale }) => `/${locale}/${doc.slug}/${doc.title}`,
    },
  },
})

const invalidPaths: RedirectsOptions = {
  collections: {
    articles: {
      identifier: 'slug',
      // @ts-expect-error Locale keys must match Payload's generated locale union.
      paths: { en: '/articles/[slug]', fr: '/fr/articles/[slug]' },
    },
  },
}

const invalidPrefix: RedirectsOptions = {
  // @ts-expect-error Prefix keys must match Payload's generated locale union.
  localePrefix: { en: '', fr: '/fr' },
}

void invalidPaths
void invalidPrefix

const origin: RedirectOrigin = 'auto'
const statusCode: RedirectStatusCode = 301
void origin
void statusCode
