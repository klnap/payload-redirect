import type { PayloadRequest } from "payload";

/**
 * Serializes writes to the redirect rule graph. The loop and duplicate checks read committed rows,
 * so two concurrent writes that each close a cycle could both pass unless the second waits for the
 * first to commit. The lock is transaction-scoped and released at commit or rollback.
 *
 * Postgres is the supported adapter: the lock needs the request transaction and READ COMMITTED
 * isolation, and the function throws when either is missing rather than checking without it.
 * Adapters without advisory locks return without locking.
 */
const LOCK_KEY = "payload-redirect:rule-graph";
const POSTGRES_ADAPTER_PATTERN = /postgres/;

type TransactionQueryable = {
  execute: (query: string) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

type DbWithSessions = {
  packageName?: string;
  sessions?: Record<string, { db?: unknown } | undefined>;
};

export async function lockRedirectRuleGraph(req: PayloadRequest): Promise<void> {
  const db = req.payload?.db as unknown as DbWithSessions | undefined;
  // No database adapter means there is no transaction graph to serialize against.
  if (db == null) return;
  if (!POSTGRES_ADAPTER_PATTERN.test(db.packageName ?? "")) return;

  const transactionID = await req.transactionID;
  const session = transactionID == null ? undefined : db.sessions?.[String(transactionID)];
  const tx = session?.db as TransactionQueryable | undefined;
  if (tx == null || typeof tx.execute !== "function") {
    throw new Error("Redirect rule lock needs the request transaction; refusing without it.");
  }

  // LOCK_KEY is a constant, so inlining it into the SQL text is safe.
  await tx.execute(`select pg_advisory_xact_lock(hashtext('${LOCK_KEY}'))`);

  const isolation = await tx.execute("show transaction_isolation");
  if (isolation.rows[0]?.transaction_isolation !== "read committed") {
    throw new Error("Redirect rule lock requires READ COMMITTED transactions.");
  }
}
