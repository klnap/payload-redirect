import { describe, expect, test } from "bun:test";
import { defaultRedirectAccess } from "#redirect/core/redirects/collection/access";
import { REDIRECT_CONTEXT_KEYS } from "#redirect/core/redirects/context-keys";

const human = { user: { id: "u1", type: "human" } };
const service = { user: { id: "s1", type: "service" } };
const internal = { user: undefined, context: { [REDIRECT_CONTEXT_KEYS.internal]: true } };
const anonymous = { user: undefined };

const access = (fn: unknown, reqPart: Record<string, unknown>) =>
  (fn as (args: { req: unknown }) => boolean)({ req: reqPart });

describe("manual redirect write access", () => {
  test("human staff may create, update, and delete manual rules", () => {
    expect(access(defaultRedirectAccess.create, human)).toBe(true);
    expect(access(defaultRedirectAccess.update, human)).toBe(true);
    expect(access(defaultRedirectAccess.delete, human)).toBe(true);
  });

  test("service principals and anonymous requests cannot write manual rules", () => {
    for (const request of [service, anonymous]) {
      expect(access(defaultRedirectAccess.create, request)).toBe(false);
      expect(access(defaultRedirectAccess.update, request)).toBe(false);
      expect(access(defaultRedirectAccess.delete, request)).toBe(false);
    }
  });

  test("package-internal automatic writes can create and update rules, not delete them", () => {
    expect(access(defaultRedirectAccess.create, internal)).toBe(true);
    expect(access(defaultRedirectAccess.update, internal)).toBe(true);
    expect(access(defaultRedirectAccess.delete, internal)).toBe(false);
  });
});
