import { describe, expect, it } from "bun:test";
import { RedirectValidationError } from "#redirect/core/redirects/model/errors";
import {
  assertRelativeRedirectPath,
  normalizePathOrUrl,
  normalizeRedirectSourcePath,
  normalizeRelativeRedirectPath,
  pathsEqual,
} from "#redirect/core/redirects/normalize-path";

describe("url normalization", () => {
  it("adds leading slash to paths", () => {
    expect(normalizePathOrUrl("blog/old")).toBe("/blog/old");
  });

  it("collapses duplicate slashes in path", () => {
    expect(normalizePathOrUrl("/blog//old")).toBe("/blog/old");
  });

  it("removes trailing slash except root", () => {
    expect(normalizePathOrUrl("/blog/old/")).toBe("/blog/old");
    expect(normalizePathOrUrl("/")).toBe("/");
  });

  it("canonicalizes literal and percent-encoded dot segments", () => {
    for (const path of ["/a/../b", "/%2e%2e/b", "/a/.%2e/b", "/a/%2E./b"]) {
      expect(normalizeRelativeRedirectPath(path)).toBe("/b");
      expect(pathsEqual("/b", path)).toBe(true);
    }
    expect(normalizeRelativeRedirectPath("/../../b")).toBe("/b");
  });

  it("preserves Unicode and encoded path segments without decoding them", () => {
    expect(normalizeRelativeRedirectPath("/café")).toBe("/café");
    expect(pathsEqual("/café", "/caf%C3%A9")).toBe(false);
    expect(pathsEqual("/a%2fb", "/a%2Fb")).toBe(false);
    expect(normalizeRelativeRedirectPath("/a%2Fb")).toBe("/a%2Fb");
  });

  it("rejects fragments in source paths but preserves destination fragments", () => {
    expect(() => normalizeRedirectSourcePath("/old#section")).toThrow(/fragment/);
    expect(normalizeRelativeRedirectPath("/new#section")).toBe("/new#section");
  });

  it("preserves query and fragment on absolute URLs", () => {
    expect(normalizePathOrUrl("https://example.com/a/?q=1#frag")).toBe(
      "https://example.com/a?q=1#frag",
    );
  });

  it("rejects empty paths", () => {
    expect(() => normalizePathOrUrl("   ")).toThrow(RedirectValidationError);
  });

  it("pathsEqual uses normalization", () => {
    expect(pathsEqual("/a/", "a")).toBe(true);
  });
});

describe("relative redirect paths", () => {
  it("normalizes valid relative paths", () => {
    expect(normalizeRelativeRedirectPath("blog/old")).toBe("/blog/old");
  });

  it("rejects backslashes and control characters that URL parsers treat as host separators", () => {
    expect(() => assertRelativeRedirectPath("/\\evil.example")).toThrow(RedirectValidationError);
    expect(() => assertRelativeRedirectPath("/\t/evil.example")).toThrow(RedirectValidationError);
    expect(() => assertRelativeRedirectPath("/a\nb")).toThrow(RedirectValidationError);
    expect(() => normalizeRelativeRedirectPath("/\\evil.example")).toThrow(RedirectValidationError);
  });

  it("rejects protocol and hostname forms", () => {
    expect(() => assertRelativeRedirectPath("https://example.com/a")).toThrow(
      RedirectValidationError,
    );
    expect(() => assertRelativeRedirectPath("//cdn.example/a")).toThrow(RedirectValidationError);
    expect(() => assertRelativeRedirectPath("www.example.com/page")).toThrow(
      RedirectValidationError,
    );
    expect(() => assertRelativeRedirectPath("  ")).toThrow(
      "from/to must be a non-empty site-relative path",
    );
    expect(assertRelativeRedirectPath("/..")).toBeUndefined();
    expect(normalizeRelativeRedirectPath("/..")).toBe("/");
  });
});
