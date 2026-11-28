import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import { closeTestPostgresPool } from "../helpers/test-postgres";

// A pool whose end() resolves before its clients are closed, as pg-pool's does.
class EarlyEndingPool extends EventEmitter {
  ending = false;
  readonly clients = [{ release: () => {} }, { release: () => {} }];
  readonly _clients = this.clients;
  readonly _idle: Array<{ client: unknown }> = [];
  readonly closed: number[] = [];
  get totalCount() {
    return this._clients.length;
  }
  end(): Promise<void> {
    this.ending = true;
    this._clients.forEach((_, index) => {
      setTimeout(() => {
        this.closed.push(index);
        this.emit("remove");
      }, 20);
    });
    return Promise.resolve();
  }
}

describe("closeTestPostgresPool", () => {
  it("resolves only after every client has closed", async () => {
    const pool = new EarlyEndingPool();
    await closeTestPostgresPool(pool as never);
    expect(pool.closed.length).toBe(2);
  });

  it("returns immediately for a pool that has no clients", async () => {
    const pool = new EarlyEndingPool();
    pool._clients.length = 0;
    await closeTestPostgresPool(pool as never);
    expect(pool.closed.length).toBe(0);
  });
});
