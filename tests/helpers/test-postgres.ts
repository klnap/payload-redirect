import { randomBytes } from "node:crypto";
import { Client } from "pg";

type TestPoolClient = {
  release(error?: Error | boolean): void;
};

type TestPostgresPool = {
  _clients: TestPoolClient[];
  _idle: Array<{ client: TestPoolClient }>;
  ending?: boolean;
  end(): Promise<void>;
};

async function withAdmin(baseUrl: string, query: string): Promise<void> {
  const url = new URL(baseUrl);
  assertSafePostgresHost(url.hostname);
  url.pathname = "/postgres";
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    await client.query(query);
  } finally {
    await client.end();
  }
}

export function assertSafePostgresHost(hostname: string): void {
  if (/(^|[.-])prod(?:uction)?([.-]|$)/i.test(hostname)) {
    throw new Error("Refusing to run integration tests against a production PostgreSQL host");
  }
  if (
    !["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname) &&
    !/(^|[.-])(test|testing|disposable|integration)([.-]|$)/i.test(hostname)
  ) {
    throw new Error(
      "PostgreSQL test hosts must be loopback or marked test, disposable, or integration",
    );
  }
}

export async function createIsolatedDatabase(baseUrl: string, suite: "redirect") {
  const database = `${suite}_int_${randomBytes(6).toString("hex")}`;
  const url = new URL(baseUrl);
  url.pathname = `/${database}`;
  await withAdmin(baseUrl, `CREATE DATABASE "${database}"`);
  return { url: url.toString(), database };
}

export async function dropIsolatedDatabase(baseUrl: string, database: string): Promise<void> {
  if (!/^redirect_int_[0-9a-f]{12}$/.test(database)) {
    throw new Error("Expected an isolated integration database name");
  }
  await withAdmin(baseUrl, `DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
}

export async function closeTestPostgresPool(pool: TestPostgresPool): Promise<void> {
  // pg-pool rejects a second end(); the fixture and the test may both close the same pool.
  if (pool.ending) return;
  const idleClients = new Set(pool._idle.map(({ client }) => client));

  for (const client of pool._clients) {
    if (!idleClients.has(client)) client.release(true);
  }

  await pool.end();
}
