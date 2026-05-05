import { describe, expect, it } from "vitest";
import { computeDiff } from "./diff.js";
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

describe("computeDiff", () => {
  it("should detect added servers", () => {
    const previous = [makeServer({ id: 1 })];
    const current = [makeServer({ id: 1 }), makeServer({ id: 2 })];

    const diff = computeDiff(previous, current);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].id).toBe(2);
    expect(diff.removed).toHaveLength(0);
    expect(diff.priceChanged).toHaveLength(0);
  });

  it("should detect removed servers", () => {
    const previous = [makeServer({ id: 1 }), makeServer({ id: 2 })];
    const current = [makeServer({ id: 1 })];

    const diff = computeDiff(previous, current);
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0].id).toBe(2);
    expect(diff.added).toHaveLength(0);
  });

  it("should detect price changes", () => {
    const previous = [makeServer({ id: 1, price: 50 })];
    const current = [makeServer({ id: 1, price: 45 })];

    const diff = computeDiff(previous, current);
    expect(diff.priceChanged).toHaveLength(1);
    expect(diff.priceChanged[0].server.price).toBe(45);
    expect(diff.priceChanged[0].previousPrice).toBe(50);
  });

  it("should handle all change types simultaneously", () => {
    const previous = [
      makeServer({ id: 1, price: 50 }),
      makeServer({ id: 2, price: 60 }),
    ];
    const current = [
      makeServer({ id: 1, price: 45 }),
      makeServer({ id: 3, price: 70 }),
    ];

    const diff = computeDiff(previous, current);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].id).toBe(3);
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0].id).toBe(2);
    expect(diff.priceChanged).toHaveLength(1);
    expect(diff.priceChanged[0].server.id).toBe(1);
  });

  it("should return empty diff for identical arrays", () => {
    const servers = [makeServer({ id: 1 }), makeServer({ id: 2 })];
    const diff = computeDiff(servers, [...servers]);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.priceChanged).toHaveLength(0);
  });

  it("should handle empty previous array", () => {
    const current = [makeServer({ id: 1 }), makeServer({ id: 2 })];
    const diff = computeDiff([], current);
    expect(diff.added).toHaveLength(2);
    expect(diff.removed).toHaveLength(0);
  });

  it("should handle empty current array", () => {
    const previous = [makeServer({ id: 1 }), makeServer({ id: 2 })];
    const diff = computeDiff(previous, []);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(2);
  });

  it("should handle both arrays empty", () => {
    const diff = computeDiff([], []);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.priceChanged).toHaveLength(0);
  });

  it("should not report non-price field changes", () => {
    const previous = [makeServer({ id: 1, datacenter: "FSN1-DC14" })];
    const current = [makeServer({ id: 1, datacenter: "HEL1-DC2" })];

    const diff = computeDiff(previous, current);
    expect(diff.priceChanged).toHaveLength(0);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });

  it("should handle completely different server sets", () => {
    const previous = [makeServer({ id: 1 }), makeServer({ id: 2 })];
    const current = [makeServer({ id: 3 }), makeServer({ id: 4 })];

    const diff = computeDiff(previous, current);
    expect(diff.added).toHaveLength(2);
    expect(diff.removed).toHaveLength(2);
    expect(diff.priceChanged).toHaveLength(0);
  });
});
