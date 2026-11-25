import { collectScalarIdentifierTransition } from '#redirect/core/redirects/auto/publication/identifier-transitions'
import type { PublicationTransition } from '../types.js'

export type PublicationTransitionPair = {
  previous: string
  current: string
  locale?: string
  previousDoc?: Record<string, unknown>
  currentDoc?: Record<string, unknown>
}

export const publicationTransitionsToPairs = (
  transitions: PublicationTransition[]
): PublicationTransitionPair[] => {
  const pairs: PublicationTransitionPair[] = []
  for (const t of transitions) {
    if (!t.published) continue
    const scalar = collectScalarIdentifierTransition({
      previous: t.previous,
      current: t.current,
    })
    if (!scalar) continue
    pairs.push({
      previous: scalar.previous,
      current: scalar.current,
      locale: t.locale,
      previousDoc: t.previousDoc,
      currentDoc: t.currentDoc,
    })
  }
  return pairs
}
