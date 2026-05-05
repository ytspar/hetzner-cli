import { describe, expect, it } from "vitest";
import type { DiffResult, PriceChange } from "./diff.js";
import { formatDiff } from "./diff-formatter.js";
import type { StoredSnapshot } from "./store.js";
import type { AuctionServer } from "./types.js";

function makeServer(overrides: Partial<AuctionServer> = {}): AuctionServer {
  return {
    id: 1000,
    bandwidth: 1000,
    cpu: "Intel Core i7-6700",
    cpu_count: 1,
    datacenter: "FSN1-DC14",
    datacenter_hr: "Falkenstein 1 DC14",
    description: ["Intel Core i7-6700"],
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

const prevSnapshot: StoredSnapshot = {
  id: 1,
  takenAt: "2026-03-15 10:00:00",
  serverCount: 100,
  currency: "EUR",
};

const currSnapshot: StoredSnapshot = {
  id: 2,
  takenAt: "2026-03-15 10:05:00",
  serverCount: 101,
  currency: "EUR",
};

describe("formatDiff", () => {
  it("should show no-change message for empty diff", () => {
    const diff: DiffResult = { added: [], removed: [], priceChanged: [] };
    const output = formatDiff(diff, prevSnapshot, currSnapshot);
    expect(output).toContain("No changes detected");
    expect(output).toContain("101 servers");
  });

  it("should format added servers", () => {
    const diff: DiffResult = {
      added: [makeServer({ id: 42, price: 55.0 })],
      removed: [],
      priceChanged: [],
    };
    const output = formatDiff(diff, prevSnapshot, currSnapshot);
    expect(output).toContain("1 new server(s)");
    expect(output).toContain("42");
    expect(output).toContain("55.00");
  });

  it("should format removed servers", () => {
    const diff: DiffResult = {
      added: [],
      removed: [makeServer({ id: 99, price: 30.0 })],
      priceChanged: [],
    };
    const output = formatDiff(diff, prevSnapshot, currSnapshot);
    expect(output).toContain("1 removed server(s)");
    expect(output).toContain("99");
  });

  it("should format price changes", () => {
    const change: PriceChange = {
      server: makeServer({ id: 10, price: 40.0 }),
      previousPrice: 50.0,
    };
    const diff: DiffResult = {
      added: [],
      removed: [],
      priceChanged: [change],
    };
    const output = formatDiff(diff, prevSnapshot, currSnapshot);
    expect(output).toContain("1 price change(s)");
    expect(output).toContain("50.00");
    expect(output).toContain("40.00");
    expect(output).toContain("-10.00");
  });

  it("should format price increases with positive sign", () => {
    const change: PriceChange = {
      server: makeServer({ id: 10, price: 60.0 }),
      previousPrice: 50.0,
    };
    const diff: DiffResult = {
      added: [],
      removed: [],
      priceChanged: [change],
    };
    const output = formatDiff(diff, prevSnapshot, currSnapshot);
    expect(output).toContain("+10.00");
  });

  it("should show snapshot summary header", () => {
    const diff: DiffResult = {
      added: [makeServer({ id: 1 })],
      removed: [],
      priceChanged: [],
    };
    const output = formatDiff(diff, prevSnapshot, currSnapshot);
    expect(output).toContain("snapshot #1");
    expect(output).toContain("#2");
    expect(output).toContain("1 added");
    expect(output).toContain("0 removed");
  });

  it("should handle all change types together", () => {
    const diff: DiffResult = {
      added: [makeServer({ id: 1 })],
      removed: [makeServer({ id: 2 })],
      priceChanged: [
        { server: makeServer({ id: 3, price: 40 }), previousPrice: 45 },
      ],
    };
    const output = formatDiff(diff, prevSnapshot, currSnapshot);
    expect(output).toContain("1 added");
    expect(output).toContain("1 removed");
    expect(output).toContain("1 price change");
  });

  it("should show ECC in RAM column for ECC servers", () => {
    const diff: DiffResult = {
      added: [makeServer({ id: 1, is_ecc: true })],
      removed: [],
      priceChanged: [
        {
          server: makeServer({ id: 2, is_ecc: true, price: 40 }),
          previousPrice: 50,
        },
      ],
    };
    const output = formatDiff(diff, prevSnapshot, currSnapshot);
    expect(output).toContain("ECC");
  });
});
