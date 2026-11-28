export const DEADLINE_MS: number;
export const REQUEST_TIMEOUT_MS: number;
export const POLL_MS: number;

export class PermanentRegistryError extends Error {}
export class NotReadyError extends Error {}

export function classifyNpmFailure(error: unknown, field: string, spec: string): Error;
export function unwrapNpmValue(value: unknown): unknown;

export interface RegistryDeps {
  view: (spec: string, field: string, timeoutMs: number) => Promise<unknown>;
  fetch?: (url: string, init: { signal: AbortSignal }) => Promise<Response>;
}

export function probeVersion(
  spec: string,
  timeoutMs: number,
  deps?: RegistryDeps,
): Promise<string | undefined>;
export function probeAttestations(
  spec: string,
  timeoutMs: number,
  deps?: RegistryDeps,
): Promise<number>;

export function awaitRegistry(options: {
  name: string;
  version: string;
  deadlineMs?: number;
  requestTimeoutMs?: number;
  pollMs?: number;
  probeVersionFn?: (spec: string, timeoutMs: number) => Promise<string | undefined>;
  probeAttestationsFn?: (spec: string, timeoutMs: number) => Promise<number>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
}): Promise<void>;
