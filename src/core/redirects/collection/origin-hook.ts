import type { CollectionBeforeChangeHook } from "payload";
import { REDIRECT_CONTEXT_KEYS } from "../context-keys.js";

export const createRedirectOriginBeforeChange = (): CollectionBeforeChangeHook => async (args) => {
  const { data, operation, req } = args;

  // This marker tracks automatic-rule provenance; Local API overrideAccess grants the privilege.
  if (req.context?.[REDIRECT_CONTEXT_KEYS.autoWrite]) {
    data.origin = "auto";
  } else if (operation === "create") {
    data.origin = "manual";
  } else {
    data.origin =
      args.originalDoc?.origin === "auto" ? "manual" : (args.originalDoc?.origin ?? "manual");
  }

  return data;
};
