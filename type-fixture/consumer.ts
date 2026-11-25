import {
  type RedirectCollectionOptions,
  type RedirectOrigin,
  type RedirectStatusCode,
  type RedirectsOptions,
  redirects,
} from '@klnap/payload-redirect'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { buildConfig, type CollectionConfig, type Payload } from 'payload'

declare module 'payload' {
  interface GeneratedTypes {
    collections: {
      articles: {
        id: string
        slug: string
        title: string
      }
      projects: {
        id: string
        slug: string
        title: string
        category: string
      }
      redirects: {
        id: string
        from: string
        to: string
        statusCode: '301' | '302'
        enabled: boolean
        origin: 'manual' | 'auto'
      }
    }
    locale: 'de' | 'en' | 'pl'
  }
}

const articlePath = {
  path: '/articles/[slug]',
} satisfies RedirectCollectionOptions<'articles'>

const articles: CollectionConfig = {
  slug: 'articles',
  fields: [],
  custom: { redirect: articlePath },
}

const manualOnlyConfig = buildConfig({
  secret: 'fixture-secret',
  db: postgresAdapter({ pool: { connectionString: 'postgres://localhost/fixture' } }),
  plugins: [redirects()],
})

const localizedCentralConfig = buildConfig({
  secret: 'fixture-secret',
  db: postgresAdapter({ pool: { connectionString: 'postgres://localhost/fixture' } }),
  localization: {
    locales: ['pl', 'en', 'de'],
    defaultLocale: 'pl',
  },
  collections: [
    {
      slug: 'articles',
      versions: { drafts: true },
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true, localized: true },
      ],
    },
    {
      slug: 'projects',
      versions: { drafts: true },
      fields: [{ name: 'slug', type: 'text', required: true, localized: true }],
    },
  ],
  plugins: [
    redirects({
      localePrefixes: { pl: '', en: '/en', de: '/de' },
      collections: {
        articles: { path: '/[slug]' },
        projects: {
          paths: {
            pl: '/realizacje/[slug]',
            en: '/work/[slug]',
            de: '/projekte/[slug]',
          },
        },
      },
    }),
  ],
})

redirects({
  localePrefixes: { en: '', pl: '/pl', de: '/de' },
  collections: {
    articles: {
      getPath: ({ doc, locale }) => `${locale ? `/${locale}` : ''}/${doc.slug}/${doc.title}`,
    },
  },
})

const projectRedirect = {
  paths: {
    pl: '/realizacje/[slug]',
    en: '/work/[slug]',
    de: '/projekte/[slug]',
  },
} satisfies RedirectCollectionOptions<'projects'>

const projects: CollectionConfig = {
  slug: 'projects',
  versions: { drafts: true },
  custom: { redirect: projectRedirect },
  fields: [{ name: 'slug', type: 'text', required: true, localized: true }],
}

const customPath = {
  getPath: ({ doc, locale }) =>
    doc.slug && doc.category ? `${locale ? `/${locale}` : ''}/${doc.category}/${doc.slug}` : null,
} satisfies RedirectCollectionOptions<'projects'>

const collectionOverrides = redirects({
  overrides: {
    slug: 'url-rules',
    labels: { singular: 'URL rule', plural: 'URL rules' },
    admin: { group: 'Settings' },
    trash: true,
  },
})

declare const payload: Payload
const enabledRules = payload.find({
  collection: 'redirects',
  where: { enabled: { equals: true } },
  depth: 0,
})

const invalidLocalePath: RedirectsOptions = {
  collections: {
    articles: {
      // @ts-expect-error Locale path maps must include every generated locale.
      paths: {
        en: '/articles/[slug]',
        pl: '/pl/articles/[slug]',
      },
    },
  },
}

const invalidUnknownLocalePath: RedirectsOptions = {
  collections: {
    articles: {
      paths: {
        de: '/de/articles/[slug]',
        en: '/articles/[slug]',
        pl: '/pl/articles/[slug]',
        // @ts-expect-error Locale path maps reject unknown Payload locales.
        fr: '/fr/articles/[slug]',
      },
    },
  },
}

const invalidPrefix: RedirectsOptions = {
  // @ts-expect-error Prefix maps must use generated locale codes.
  localePrefixes: { en: '', pl: '/pl', de: '/de', fr: '/fr' },
}

// @ts-expect-error Only one path strategy is allowed.
const invalidStrategy: RedirectCollectionOptions<'articles'> = {
  path: '/articles/[slug]',
  paths: {
    de: '/de/articles/[slug]',
    en: '/articles/[slug]',
    pl: '/pl/articles/[slug]',
  },
}

const invalidCollection: RedirectsOptions = {
  collections: {
    // @ts-expect-error Collection names must match generated Payload types.
    misspelledArticles: { path: '/[slug]' },
  },
}

const origin: RedirectOrigin = 'auto'
const statusCode: RedirectStatusCode = 301
void articles
void manualOnlyConfig
void localizedCentralConfig
void projects
void customPath
void collectionOverrides
void enabledRules
void invalidLocalePath
void invalidUnknownLocalePath
void invalidPrefix
void invalidStrategy
void invalidCollection
void origin
void statusCode
