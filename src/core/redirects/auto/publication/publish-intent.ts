import type { PayloadRequest } from 'payload'

export const isDraftSave = (req: PayloadRequest): boolean =>
  req.query?.draft === 'true' || req.query?.draft === true

export const isUnpublishedStatus = (status: unknown): boolean => {
  if (status === 'published') return false
  if (status === 'draft' || status == null) return true
  if (typeof status === 'object') {
    return !Object.values(status as Record<string, unknown>).includes('published')
  }
  return true
}

export const isPublishIntent = (data: unknown): boolean => {
  if (!data || typeof data !== 'object') return false
  const status = (data as Record<string, unknown>)._status
  if (status === 'published') return true
  if (status && typeof status === 'object') {
    return Object.values(status as Record<string, unknown>).includes('published')
  }
  return false
}

export const isLocalePublished = (
  status: unknown,
  locale: string,
  localizeStatus: boolean
): boolean => {
  if (typeof status === 'object' && status !== null) {
    return (status as Record<string, unknown>)[locale] === 'published'
  }
  if (status === 'published') {
    return !localizeStatus
  }
  return false
}
