export type PublicationTransition = {
  published: boolean
  locale?: string
  previous?: string
  current?: string
  previousDoc?: Record<string, unknown>
  currentDoc?: Record<string, unknown>
}

export type GetPublicationTransitionOptions = {
  identifier: string
}
