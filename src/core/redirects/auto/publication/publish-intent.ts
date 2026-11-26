import type { PayloadRequest } from "payload";

export const isDraftSave = (req: PayloadRequest): boolean =>
  req.query?.draft === "true" || req.query?.draft === true;

export const isLocalePublished = (status: unknown, locale: string): boolean => {
  if (typeof status === "object" && status !== null) {
    return (status as Record<string, unknown>)[locale] === "published";
  }
  return status === "published";
};
