export type PublicationTransition = {
  published: boolean
  locale?: string
  previous?: string
  current?: string
}

export type GetPublicationTransitionOptions = {
  identifier: string
}
