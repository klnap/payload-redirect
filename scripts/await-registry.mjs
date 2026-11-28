#!/usr/bin/env node
// Waits until npm serves the exact version in package.json and its provenance attestations.
// The deadline covers the whole wait, including the time each npm or HTTP request takes.
// Usage (from the package root): node scripts/await-registry.mjs
import { execFile } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

export const DEADLINE_MS = 10 * 60_000;
export const REQUEST_TIMEOUT_MS = 30_000;
export const POLL_MS = 10_000;

// Cannot become ready by waiting (for example, bad credentials or npm not installed).
export class PermanentRegistryError extends Error {}

// Transient: not served yet, network failure, timeout, or server error. Retried until the deadline.
export class NotReadyError extends Error {}

// Maps a failed `npm view` to the retry decision. Exported for tests.
export function classifyNpmFailure(error, field, spec) {
  const text = `${error.stderr ?? ""}${error.message ?? ""}`;
  if (error.code === "ENOENT")
    return new PermanentRegistryError("npm is not installed or not on PATH");
  if (/E404|No match found/i.test(text))
    return new NotReadyError(`npm has no ${field} for ${spec} yet`);
  if (/\bE40[13]\b|\b40[13]\s+(Unauthorized|Forbidden)\b/i.test(text)) {
    return new PermanentRegistryError(
      `npm rejected the read (${field} for ${spec}); check registry access`,
    );
  }
  const reason = error.code ?? error.signal ?? text.trim().split("\n")[0];
  return new NotReadyError(`npm view ${field} failed transiently: ${String(reason).slice(0, 200)}`);
}

const realView = async (spec, field, timeoutMs) => {
  const { stdout } = await run("npm", ["view", spec, field, "--json"], {
    timeout: timeoutMs,
    env: {
      ...process.env,
      npm_config_fetch_timeout: String(timeoutMs),
      npm_config_fetch_retries: "0",
    },
  });
  return stdout.trim() ? unwrapNpmValue(JSON.parse(stdout)) : undefined;
};

// npm 12 wraps a single `npm view` result in an array; npm 11 returns the value itself. Exported for tests.
export function unwrapNpmValue(value) {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

// `deps` lets tests replace the npm and HTTP calls; production uses the defaults.
export async function probeVersion(spec, timeoutMs, deps = { view: realView }) {
  try {
    return await deps.view(spec, "version", timeoutMs);
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new NotReadyError("npm returned unreadable version metadata");
    throw classifyNpmFailure(error, "version", spec);
  }
}

export async function probeAttestations(
  spec,
  timeoutMs,
  deps = { view: realView, fetch: globalThis.fetch },
) {
  const started = Date.now();
  let url;
  try {
    url = await deps.view(spec, "dist.attestations.url", timeoutMs);
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new NotReadyError("npm returned unreadable attestation metadata");
    throw classifyNpmFailure(error, "dist.attestations.url", spec);
  }
  // The packument can lag the version: no URL yet is a retry, not a failure.
  if (!url) throw new NotReadyError(`npm has no attestation URL for ${spec} yet`);

  // Keep the whole probe inside timeoutMs: the npm call above has already used part of it.
  const left = Math.max(timeoutMs - (Date.now() - started), 1);
  let response;
  try {
    response = await deps.fetch(url, { signal: AbortSignal.timeout(left) });
  } catch {
    throw new NotReadyError("attestation request failed transiently");
  }
  if (response.status === 404) throw new NotReadyError("attestations are not served yet");
  if (response.status === 401 || response.status === 403) {
    throw new PermanentRegistryError(`attestation endpoint returned ${response.status}`);
  }
  if (!response.ok) throw new NotReadyError(`attestation endpoint returned ${response.status}`);
  const body = await response.json().catch(() => null);
  if (!Array.isArray(body?.attestations) || body.attestations.length === 0) {
    throw new NotReadyError("attestation response has no attestations yet");
  }
  return body.attestations.length;
}

// Returns when both the exact version and its attestations are served. Throws on deadline or permanent error.
export async function awaitRegistry({
  name,
  version,
  deadlineMs = DEADLINE_MS,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
  pollMs = POLL_MS,
  probeVersionFn = probeVersion,
  probeAttestationsFn = probeAttestations,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = console.log,
}) {
  const spec = `${name}@${version}`;
  const start = now();
  const deadline = start + deadlineMs;
  let attempt = 0;
  let lastState = "no attempt completed";

  for (;;) {
    attempt += 1;
    const remaining = deadline - now();
    if (remaining <= 0) break;
    const timeoutMs = Math.min(requestTimeoutMs, remaining);
    const elapsed = Math.round((now() - start) / 1000);
    try {
      const served = await probeVersionFn(spec, timeoutMs);
      if (served !== version)
        throw new NotReadyError(`npm serves ${served ?? "no version"}, not ${version}`);
      // Recompute: the version request has already used part of this attempt's budget.
      const attestationBudget = Math.min(requestTimeoutMs, deadline - now());
      if (attestationBudget <= 0) break;
      await probeAttestationsFn(spec, attestationBudget);
      log(`[registry] ${spec} and its attestations are served (attempt ${attempt}, ${elapsed}s).`);
      return;
    } catch (error) {
      if (error instanceof PermanentRegistryError) throw error;
      if (!(error instanceof NotReadyError)) throw error;
      lastState = error.message;
      log(`[registry] attempt ${attempt} at ${elapsed}s: ${error.message}`);
    }
    const left = deadline - now();
    if (left <= 0) break;
    await sleep(Math.min(pollMs, left));
  }

  throw new Error(
    `npm did not serve ${spec} and its attestations within ${Math.round(deadlineMs / 1000)}s ` +
      `after ${attempt} attempt(s). Last state: ${lastState}. ` +
      `This run already published; do not publish again. Check https://www.npmjs.com/package/${name}, ` +
      "then re-run the failed verify-release jobs with `gh run rerun <run-id> --failed`.",
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  try {
    await awaitRegistry({ name: pkg.name, version: pkg.version });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
