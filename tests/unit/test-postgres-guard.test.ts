import { describe, expect, it } from "bun:test";
import { createIsolatedDatabase } from "../helpers/test-postgres";

// The guard runs before any connection, so these checks need no PostgreSQL server.
describe("integration database guard", () => {
  it("rejects a URL whose host query parameter would override the checked hostname", async () => {
    await expect(
      createIsolatedDatabase(
        "postgres://postgres:secret@127.0.0.1:5432/postgres?host=prod-db.example.com",
        "redirect",
      ),
    ).rejects.toThrow("host or hostaddr query parameters");
  });

  it("rejects a hostaddr override the same way", async () => {
    await expect(
      createIsolatedDatabase(
        "postgres://postgres:secret@127.0.0.1:5432/postgres?hostaddr=10.0.0.5",
        "redirect",
      ),
    ).rejects.toThrow("host or hostaddr query parameters");
  });

  it("rejects production-looking hosts", async () => {
    await expect(
      createIsolatedDatabase(
        "postgres://postgres:secret@db-production.example.com/postgres",
        "redirect",
      ),
    ).rejects.toThrow("production PostgreSQL host");
  });
});
