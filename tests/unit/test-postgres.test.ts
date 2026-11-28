import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import { assertSafePostgresHost, closeTestPostgresPool } from "../helpers/test-postgres";

describe("integration database host guard", () => {
  it("rejects production hostnames", () => {
    expect(() => assertSafePostgresHost("payload-prod.example.com")).toThrow(
      "Refusing to run integration tests against a production PostgreSQL host",
    );
  });

  it("rejects unmarked remote hosts", () => {
    expect(() => assertSafePostgresHost("db.example.com")).toThrow(
      "PostgreSQL test hosts must be loopback or marked test, disposable, or integration",
    );
  });

  it("allows loopback and explicitly disposable hosts", () => {
    expect(() => assertSafePostgresHost("localhost")).not.toThrow();
    expect(() => assertSafePostgresHost("pg-test.example.com")).not.toThrow();
  });

  it("releases Payload-held clients before ending the pool", async () => {
    const calls: string[] = [];
    const idle = { release: () => calls.push("idle-release") };
    const checkedOut = {
      release: (destroy?: boolean) => calls.push(`checked-out-release:${destroy}`),
    };
    // Shaped like pg-pool: 'remove' fires for each client once its socket has closed.
    const pool = Object.assign(new EventEmitter(), {
      _clients: [idle, checkedOut],
      _idle: [{ client: idle }],
      get totalCount() {
        return this._clients.length;
      },
      end: async () => {
        calls.push("end");
        for (const _ of [idle, checkedOut]) queueMicrotask(() => pool.emit("remove"));
      },
    });

    await closeTestPostgresPool(pool);

    expect(calls).toEqual(["checked-out-release:true", "end"]);
  });
});
