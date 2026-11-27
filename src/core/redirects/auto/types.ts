import type { TypedLocale } from "payload";

export type RedirectPathOptions<TDocument = Record<string, unknown>> =
  | {
      enabled?: true;
      path: string;
      paths?: never;
      getPath?: never;
    }
  | {
      enabled?: true;
      path?: never;
      paths: string extends Extract<TypedLocale, string>
        ? Record<string, string>
        : Record<Extract<TypedLocale, string>, string>;
      getPath?: never;
    }
  | {
      enabled?: true;
      path?: never;
      paths?: never;
      getPath: (args: { doc: TDocument; locale: TypedLocale | undefined }) => string | null;
    }
  | {
      enabled: false;
      path?: never;
      paths?: never;
      getPath?: never;
    };

export type PublicationTransition = {
  locale?: string;
  currentDoc: Record<string, unknown>;
  publishedDocs: Record<string, unknown>[];
};
