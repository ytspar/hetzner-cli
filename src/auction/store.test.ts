import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getLatestSnapshot,
  getSnapshotServers,
  initSchema,
  openDatabase,
  pruneSnapshots,
  saveSnapshot,
} from "./store.js";
import type { AuctionServer } from "./types.js";

function makeServer(overrides: Partial<AuctionServer> = {}): AuctionServer {
  return {
    id: 1000,
    bandwidth: 1000,
    cpu: "Intel Core i7-6700",
    cpu_count: 1,
    datacenter: "FSN1-DC14",
    datacenter_hr: "Falkenstein 1 DC14",
    description: ["Intel Core i7-6700", "2x SSD 512 GB"],
    dist: ["Rescue system"],
    fixed_price: false,
    hdd_arr: ["2x SSD 512 GB"],
    hdd_count: 2,
    hdd_hr: ["2x SSD SATA 512 GB"],
    hdd_size: 1024,
    hourly_price: 0.0613,
    information: null,
    ip_price: { Amount: 1, Hourly: 0.0013, Monthly: 0.93 },
    is_ecc: false,
    is_highio: false,
    key: 1000,
    name: "Server AX41",
    next_reduce: 120,
    next_reduce_hr: false,
    next_reduce_timestamp: 1_700_000_000,
    price: 44.0,
    ram: ["4x RAM 8192 MB DDR4"],
    ram_size: 32,
    serverDiskData: { general: [], hdd: [], nvme: [], sata: [512, 512] },
    setup_price: 0,
    specials: [],
    traffic: "unlimited",
    ...overrides,
  };
}

describe("auction store", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    initSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("initSchema", () => {
    it("should create tables idempotently", () => {
      initSchema(db);
      initSchema(db);
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        .all() as { name: string }[];
      const names = tables.map((t) => t.name);
      expect(names).toContain("snapshots");
      expect(names).toContain("servers");
    });
  });

  describe("saveSnapshot", () => {
    it("should save a snapshot with servers", () => {
      const servers = [makeServer({ id: 1 }), makeServer({ id: 2, price: 55 })];
      const snapshot = saveSnapshot(db, servers, "EUR");

      expect(snapshot.id).toBe(1);
      expect(snapshot.serverCount).toBe(2);
      expect(snapshot.currency).toBe("EUR");
      expect(snapshot.takenAt).toBeTruthy();
    });

    it("should save an empty snapshot", () => {
      const snapshot = saveSnapshot(db, [], "EUR");
      expect(snapshot.serverCount).toBe(0);
    });

    it("should save multiple snapshots with incrementing IDs", () => {
      const s1 = saveSnapshot(db, [makeServer({ id: 1 })], "EUR");
      const s2 = saveSnapshot(db, [makeServer({ id: 2 })], "EUR");
      expect(s2.id).toBe(s1.id + 1);
    });

    it("should save snapshots with different currencies", () => {
      saveSnapshot(db, [makeServer({ id: 1 })], "EUR");
      saveSnapshot(db, [makeServer({ id: 2 })], "USD");

      const eurSnap = getLatestSnapshot(db, "EUR");
      const usdSnap = getLatestSnapshot(db, "USD");

      expect(eurSnap?.currency).toBe("EUR");
      expect(usdSnap?.currency).toBe("USD");
    });
  });

  describe("getLatestSnapshot", () => {
    it("should return null when no snapshots exist", () => {
      expect(getLatestSnapshot(db, "EUR")).toBeNull();
    });

    it("should return the most recent snapshot", () => {
      saveSnapshot(db, [makeServer({ id: 1 })], "EUR");
      saveSnapshot(db, [makeServer({ id: 1 }), makeServer({ id: 2 })], "EUR");

      const latest = getLatestSnapshot(db, "EUR");
      expect(latest?.serverCount).toBe(2);
      expect(latest?.id).toBe(2);
    });

    it("should filter by currency", () => {
      saveSnapshot(db, [makeServer({ id: 1 })], "EUR");
      saveSnapshot(db, [makeServer({ id: 1 }), makeServer({ id: 2 })], "USD");

      const eurLatest = getLatestSnapshot(db, "EUR");
      expect(eurLatest?.serverCount).toBe(1);
    });
  });

  describe("getSnapshotServers", () => {
    it("should return servers for a snapshot", () => {
      const servers = [
        makeServer({ id: 1, price: 44 }),
        makeServer({ id: 2, price: 55 }),
      ];
      const snapshot = saveSnapshot(db, servers, "EUR");
      const retrieved = getSnapshotServers(db, snapshot.id);

      expect(retrieved).toHaveLength(2);
      expect(retrieved[0].id).toBe(1);
      expect(retrieved[0].price).toBe(44);
      expect(retrieved[1].id).toBe(2);
      expect(retrieved[1].price).toBe(55);
    });

    it("should return empty array for unknown snapshot", () => {
      expect(getSnapshotServers(db, 999)).toEqual([]);
    });

    it("should preserve full server data through JSON roundtrip", () => {
      const server = makeServer({
        id: 42,
        specials: ["GPU", "ECC"],
        is_ecc: true,
        serverDiskData: { general: [], hdd: [], nvme: [1024, 1024], sata: [] },
      });
      const snapshot = saveSnapshot(db, [server], "EUR");
      const [retrieved] = getSnapshotServers(db, snapshot.id);

      expect(retrieved.specials).toEqual(["GPU", "ECC"]);
      expect(retrieved.is_ecc).toBe(true);
      expect(retrieved.serverDiskData.nvme).toEqual([1024, 1024]);
    });
  });

  describe("pruneSnapshots", () => {
    it("should keep the most recent snapshots for the currency", () => {
      for (let i = 0; i < 5; i++) {
        saveSnapshot(db, [makeServer({ id: i + 1 })], "EUR");
      }

      const deleted = pruneSnapshots(db, "EUR", 3);
      expect(deleted).toBe(2);

      const count = (
        db.prepare("SELECT COUNT(*) as c FROM snapshots").get() as { c: number }
      ).c;
      expect(count).toBe(3);
    });

    it("should delete associated servers via cascade", () => {
      for (let i = 0; i < 5; i++) {
        saveSnapshot(db, [makeServer({ id: i + 1 })], "EUR");
      }

      pruneSnapshots(db, "EUR", 2);

      const serverCount = (
        db.prepare("SELECT COUNT(*) as c FROM servers").get() as { c: number }
      ).c;
      expect(serverCount).toBe(2);
    });

    it("should not evict snapshots from other currencies", () => {
      for (let i = 0; i < 5; i++) {
        saveSnapshot(db, [makeServer({ id: i + 1 })], "EUR");
      }
      for (let i = 0; i < 3; i++) {
        saveSnapshot(db, [makeServer({ id: i + 1 })], "USD");
      }

      const deleted = pruneSnapshots(db, "EUR", 2);
      expect(deleted).toBe(3);

      const usdCount = (
        db
          .prepare("SELECT COUNT(*) as c FROM snapshots WHERE currency = 'USD'")
          .get() as { c: number }
      ).c;
      expect(usdCount).toBe(3);
    });

    it("should return 0 when nothing to prune", () => {
      saveSnapshot(db, [makeServer({ id: 1 })], "EUR");
      expect(pruneSnapshots(db, "EUR", 50)).toBe(0);
    });

    it("should handle empty database", () => {
      expect(pruneSnapshots(db, "EUR", 50)).toBe(0);
    });
  });

  describe("openDatabase", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = join(tmpdir(), `hctl-test-${Date.now()}`);
      mkdirSync(tmpDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("should create a database file and initialize schema", () => {
      const dbPath = join(tmpDir, "test.db");
      const testDb = openDatabase(dbPath);
      try {
        expect(existsSync(dbPath)).toBe(true);
        const tables = testDb
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
          )
          .all() as { name: string }[];
        const names = tables.map((t) => t.name);
        expect(names).toContain("snapshots");
        expect(names).toContain("servers");
      } finally {
        testDb.close();
      }
    });

    it("should create parent directories if they do not exist", () => {
      const nestedDir = join(tmpDir, "nested", "subdir");
      const dbPath = join(nestedDir, "test.db");
      expect(existsSync(nestedDir)).toBe(false);

      const testDb = openDatabase(dbPath);
      try {
        expect(existsSync(dbPath)).toBe(true);
        expect(existsSync(nestedDir)).toBe(true);
      } finally {
        testDb.close();
      }
    });

    it("should open an existing database without error", () => {
      const dbPath = join(tmpDir, "test.db");
      const db1 = openDatabase(dbPath);
      saveSnapshot(db1, [makeServer({ id: 1 })], "EUR");
      db1.close();

      const db2 = openDatabase(dbPath);
      try {
        const snapshot = getLatestSnapshot(db2, "EUR");
        expect(snapshot?.serverCount).toBe(1);
      } finally {
        db2.close();
      }
    });
  });
});
