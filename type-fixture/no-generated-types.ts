import { redirects } from '@klnap/payload-redirect'

redirects({
  collections: {
    articles: {
      getPath: ({ doc }) => `/articles/${String(doc.title)}`,
    },
  },
})
