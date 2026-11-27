import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import type { PayloadRequest } from "payload";
import { ensureAutoRedirect } from "#redirect/core/redirects/auto/persist-auto-rule";
import {
  createRedirectIntPayload,
  intDatabaseConfigured,
  type RedirectIntHandle,
} from "../helpers/payload-harness";

type TransactionDb = {
  beginTransaction: () => Promise<string | number | null>;
  commitTransaction: (id: string | number) => Promise<void>;
  rollbackTransaction: (id: string | number) => Promise<void>;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Resolves true when the promise settles, false when it is still pending after `ms`. */
const settlesWithin = (promise: Promise<unknown>, ms: number) =>
  Promise.race([
    promise.then(
      () => true,
      () => true,
    ),
    sleep(ms).then(() => false),
  ]);

/**
 * Deterministic ownership races. Each scenario holds a manual write in an open transaction, starts
 * the competing automatic or partial write, confirms it is blocked on the graph lock, commits the
 * manual write, and only then lets the competitor proceed. The expected outcome is the serialization
 * order "manual first": committed manual ownership must survive the automatic write.
 */
describe.skipIf(!intDatabaseConfigured)(
  "redirect rule ownership under concurrency (postgres)",
  () => {
    let handle: RedirectIntHandle;
    let db: TransactionDb;

    // Transactions left open by a failing assertion would hold row and advisory locks into the next test.
    const openTransactions = new Set<string | number>();

    const beginTx = async (): Promise<string | number> => {
      const id = await db.beginTransaction();
      if (id == null) throw new Error("transactions unavailable");
      openTransactions.add(id);
      return id;
    };

    const commitTx = async (id: string | number) => {
      openTransactions.delete(id);
      await db.commitTransaction(id);
    };

    const rollbackTx = async (id: string | number) => {
      openTransactions.delete(id);
      await db.rollbackTransaction(id);
    };

    afterEach(async () => {
      for (const id of [...openTransactions]) {
        await rollbackTx(id);
      }
    });

    const txReq = (transactionID: string | number) =>
      ({ payload: handle.payload, transactionID }) as unknown as PayloadRequest;

    const findByFrom = async (from: string) =>
      handle.payload.find({
        collection: "redirects",
        where: { from: { equals: from } },
        limit: 10,
        depth: 0,
        overrideAccess: true,
      });

    beforeAll(async () => {
      handle = await createRedirectIntPayload();
      db = handle.payload.db as unknown as TransactionDb;
    }, 120_000);

    afterAll(async () => {
      await handle.destroy();
    });

    it("automatic update does not overwrite a manual destination committed during its decision", async () => {
      await handle.resetRedirects();
      const seed = await beginTx();
      await ensureAutoRedirect({
        req: txReq(seed),
        collectionSlug: "redirects",
        rule: { from: "/race-dest", to: "/old" },
      });
      await commitTx(seed);

      const manualTx = await beginTx();
      const [autoRule] = (await findByFrom("/race-dest")).docs;
      await handle.payload.update({
        collection: "redirects",
        id: autoRule!.id,
        data: { to: "/manual-destination" },
        overrideAccess: true,
        req: { transactionID: manualTx } as never,
      });

      const autoTx = await beginTx();
      const automatic = ensureAutoRedirect({
        req: txReq(autoTx),
        collectionSlug: "redirects",
        rule: { from: "/race-dest", to: "/auto-destination" },
      });
      expect(await settlesWithin(automatic, 400)).toBe(false);

      await commitTx(manualTx);
      expect(await automatic).toBe("skipped");
      await commitTx(autoTx);

      const [final] = (await findByFrom("/race-dest")).docs;
      expect(final?.to).toBe("/manual-destination");
      expect(final?.origin).toBe("manual");
    });

    it("automatic update does not re-enable a rule that a manual write disabled during its decision", async () => {
      await handle.resetRedirects();
      const seed = await beginTx();
      await ensureAutoRedirect({
        req: txReq(seed),
        collectionSlug: "redirects",
        rule: { from: "/race-disable", to: "/old" },
      });
      await commitTx(seed);

      const manualTx = await beginTx();
      const [autoRule] = (await findByFrom("/race-disable")).docs;
      await handle.payload.update({
        collection: "redirects",
        id: autoRule!.id,
        data: { enabled: false },
        overrideAccess: true,
        req: { transactionID: manualTx } as never,
      });

      const autoTx = await beginTx();
      const automatic = ensureAutoRedirect({
        req: txReq(autoTx),
        collectionSlug: "redirects",
        rule: { from: "/race-disable", to: "/auto-destination" },
      });
      expect(await settlesWithin(automatic, 400)).toBe(false);

      await commitTx(manualTx);
      expect(await automatic).toBe("skipped");
      await commitTx(autoTx);

      const [final] = (await findByFrom("/race-disable")).docs;
      expect(final?.enabled).toBe(false);
      expect(final?.origin).toBe("manual");
      expect(final?.to).toBe("/old");
    });

    it("automatic create defers to a manual create committed during its decision", async () => {
      await handle.resetRedirects();

      const manualTx = await beginTx();
      await handle.payload.create({
        collection: "redirects",
        data: { from: "/race-create", to: "/manual-create", statusCode: 302, enabled: true },
        overrideAccess: true,
        req: { transactionID: manualTx } as never,
      });

      const autoTx = await beginTx();
      const automatic = ensureAutoRedirect({
        req: txReq(autoTx),
        collectionSlug: "redirects",
        rule: { from: "/race-create", to: "/auto-create" },
      });
      expect(await settlesWithin(automatic, 400)).toBe(false);

      await commitTx(manualTx);
      expect(await automatic).toBe("skipped");
      await commitTx(autoTx);

      const { docs } = await findByFrom("/race-create");
      expect(docs).toHaveLength(1);
      expect(docs[0]?.to).toBe("/manual-create");
      expect(docs[0]?.origin).toBe("manual");
    });

    it("partial update validates the committed effective rule, not a pre-lock snapshot", async () => {
      await handle.resetRedirects();
      await handle.payload.create({
        collection: "redirects",
        data: { from: "/loop-a", to: "/loop-b", statusCode: 301, enabled: true },
        overrideAccess: true,
      });
      await handle.payload.create({
        collection: "redirects",
        data: { from: "/loop-b", to: "/loop-c", statusCode: 301, enabled: false },
        overrideAccess: true,
      });
      const [second] = (await findByFrom("/loop-b")).docs;

      // Writer A points the disabled rule back at /loop-a while its change is uncommitted.
      const writerA = await beginTx();
      await handle.payload.update({
        collection: "redirects",
        id: second!.id,
        data: { to: "/loop-a" },
        overrideAccess: true,
        req: { transactionID: writerA } as never,
      });

      // Writer B enables the rule. Against the stale snapshot (to=/loop-c) it looks loop-free.
      const writerB = await beginTx();
      const enable = handle.payload.update({
        collection: "redirects",
        id: second!.id,
        data: { enabled: true },
        overrideAccess: true,
        req: { transactionID: writerB } as never,
      });
      expect(await settlesWithin(enable, 400)).toBe(false);

      await commitTx(writerA);
      const outcome = await enable.then(
        () => "accepted",
        () => "rejected",
      );
      await rollbackTx(writerB);

      expect(outcome).toBe("rejected");
      const [final] = (await findByFrom("/loop-b")).docs;
      expect(final?.to).toBe("/loop-a");
      expect(final?.enabled).toBe(false);
    });
  },
);
