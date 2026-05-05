import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_AUCTION_CACHE_BASE_URL,
  fetchAuctionData,
  fetchAuctionServers,
  filterAuctionServers,
  getAuctionDataUrl,
  sortAuctionServers,
} from "./client.js";
import type { AuctionServer } from "./types.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeServer(overrides: Partial<AuctionServer> = {}): AuctionServer {
  return {
    id: 1,
    key: 1,
    name: "SB1",
    description: ["Intel Core i7-6700", "2x SSD 512 GB"],
    information: null,
    cpu: "Intel Core i7-6700",
    cpu_count: 1,
    is_highio: false,
    is_ecc: false,
    traffic: "unlimited",
    bandwidth: 1000,
    ram: ["DDR4 32GB"],
    ram_size: 32,
    price: 29.0,
    setup_price: 0,
    hourly_price: 0.0399,
    hdd_arr: ["SSD 512 GB", "SSD 512 GB"],
    hdd_hr: ["2x SSD 512 GB"],
    hdd_size: 1024,
    hdd_count: 2,
    serverDiskData: {
      nvme: [],
      sata: [512, 512],
      hdd: [],
      general: [],
    },
    datacenter: "FSN1-DC14",
    datacenter_hr: "Falkenstein",
    specials: [],
    dist: ["Debian"],
    fixed_price: true,
    next_reduce: 0,
    next_reduce_hr: false,
    next_reduce_timestamp: 0,
    ip_price: { Monthly: 1.3, Hourly: 0.0019, Amount: 1 },
    ...overrides,
  };
}

describe("fetchAuctionServers", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("should fetch EUR auction data from the hosted cache by default", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ server: [], serverCount: 0 }),
    });

    await fetchAuctionServers();

    expect(mockFetch).toHaveBeenCalledWith(
      `${DEFAULT_AUCTION_CACHE_BASE_URL}/live_data_sb_EUR.json`
    );
  });

  it("should fetch USD auction data from the hosted cache when specified", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ server: [], serverCount: 0 }),
    });

    await fetchAuctionServers("USD");

    expect(mockFetch).toHaveBeenCalledWith(
      `${DEFAULT_AUCTION_CACHE_BASE_URL}/live_data_sb_USD.json`
    );
  });

  it("should fetch directly from Hetzner when requested", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ server: [], serverCount: 0 }),
    });

    await fetchAuctionServers("EUR", { source: "direct" });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://www.hetzner.com/_resources/app/data/app/live_data_sb_EUR.json"
    );
  });

  it("should fetch directly when HCTL_AUCTION_SOURCE is direct", async () => {
    vi.stubEnv("HCTL_AUCTION_SOURCE", "direct");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ server: [], serverCount: 0 }),
    });

    await fetchAuctionServers("USD");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://www.hetzner.com/_resources/app/data/app/live_data_sb_USD.json"
    );
  });

  it("should allow a custom hosted cache base URL", () => {
    expect(
      getAuctionDataUrl("EUR", { cacheBaseUrl: "https://example.test/cache/" })
    ).toBe("https://example.test/cache/live_data_sb_EUR.json");
  });

  it("should return hosted cache freshness metadata", async () => {
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({
        "X-Hctl-Auction-Age-Seconds": "90",
        "X-Hctl-Auction-Source": "cloudflare-r2",
        "X-Hctl-Auction-Stale": "false",
        "X-Hctl-Auction-Updated-At": "2026-05-05T15:39:54.758Z",
      }),
      ok: true,
      json: () => Promise.resolve({ server: [], serverCount: 0 }),
    });

    const result = await fetchAuctionData();

    expect(result.data).toEqual({ server: [], serverCount: 0 });
    expect(result.metadata).toMatchObject({
      ageSeconds: 90,
      source: "cloudflare-r2",
      stale: false,
      updatedAt: "2026-05-05T15:39:54.758Z",
      url: `${DEFAULT_AUCTION_CACHE_BASE_URL}/live_data_sb_EUR.json`,
    });
  });

  it("should throw on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    await expect(fetchAuctionServers()).rejects.toThrow(
      "Failed to fetch auction data: HTTP 503"
    );
  });
});

describe("filterAuctionServers", () => {
  it("should return all servers with no filters", () => {
    const servers = [makeServer(), makeServer({ id: 2 })];
    const result = filterAuctionServers(servers, {});
    expect(result).toHaveLength(2);
  });

  it("should filter by minPrice", () => {
    const servers = [
      makeServer({ price: 20 }),
      makeServer({ id: 2, price: 50 }),
    ];
    const result = filterAuctionServers(servers, { minPrice: 30 });
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(50);
  });

  it("should filter by maxPrice", () => {
    const servers = [
      makeServer({ price: 20 }),
      makeServer({ id: 2, price: 50 }),
    ];
    const result = filterAuctionServers(servers, { maxPrice: 30 });
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(20);
  });

  it("should filter by minRam and maxRam", () => {
    const servers = [
      makeServer({ ram_size: 16 }),
      makeServer({ id: 2, ram_size: 64 }),
      makeServer({ id: 3, ram_size: 128 }),
    ];
    const result = filterAuctionServers(servers, { minRam: 32, maxRam: 96 });
    expect(result).toHaveLength(1);
    expect(result[0].ram_size).toBe(64);
  });

  it("should filter by cpu substring (case insensitive)", () => {
    const servers = [
      makeServer({ cpu: "Intel Core i7-6700" }),
      makeServer({ id: 2, cpu: "AMD Ryzen 5 3600" }),
    ];
    const result = filterAuctionServers(servers, { cpu: "ryzen" });
    expect(result).toHaveLength(1);
    expect(result[0].cpu).toContain("Ryzen");
  });

  it("should filter by datacenter", () => {
    const servers = [
      makeServer({ datacenter: "FSN1-DC14" }),
      makeServer({ id: 2, datacenter: "HEL1-DC2" }),
    ];
    const result = filterAuctionServers(servers, { datacenter: "HEL" });
    expect(result).toHaveLength(1);
    expect(result[0].datacenter).toBe("HEL1-DC2");
  });

  it("should filter by minDiskSize (total across types)", () => {
    const servers = [
      makeServer({
        serverDiskData: { nvme: [512, 512], sata: [], hdd: [], general: [] },
      }),
      makeServer({
        id: 2,
        serverDiskData: { nvme: [2000, 2000], sata: [], hdd: [], general: [] },
      }),
    ];
    const result = filterAuctionServers(servers, { minDiskSize: 2000 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it("should filter by minDiskCount", () => {
    const servers = [
      makeServer({ hdd_count: 2 }),
      makeServer({ id: 2, hdd_count: 4 }),
    ];
    const result = filterAuctionServers(servers, { minDiskCount: 3 });
    expect(result).toHaveLength(1);
    expect(result[0].hdd_count).toBe(4);
  });

  it("should filter by diskType", () => {
    const servers = [
      makeServer({
        serverDiskData: { nvme: [512], sata: [], hdd: [], general: [] },
      }),
      makeServer({
        id: 2,
        serverDiskData: { nvme: [], sata: [1000], hdd: [], general: [] },
      }),
    ];
    const result = filterAuctionServers(servers, { diskType: "nvme" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("should filter by ecc", () => {
    const servers = [
      makeServer({ is_ecc: false }),
      makeServer({ id: 2, is_ecc: true }),
    ];
    const result = filterAuctionServers(servers, { ecc: true });
    expect(result).toHaveLength(1);
    expect(result[0].is_ecc).toBe(true);
  });

  it("should filter by gpu", () => {
    const servers = [
      makeServer({ specials: [] }),
      makeServer({ id: 2, specials: ["GPU"] }),
    ];
    const result = filterAuctionServers(servers, { gpu: true });
    expect(result).toHaveLength(1);
    expect(result[0].specials).toContain("GPU");
  });

  it("should filter by inic", () => {
    const servers = [
      makeServer({ specials: [] }),
      makeServer({ id: 2, specials: ["iNIC"] }),
    ];
    const result = filterAuctionServers(servers, { inic: true });
    expect(result).toHaveLength(1);
    expect(result[0].specials).toContain("iNIC");
  });

  it("should filter by fixedPrice", () => {
    const servers = [
      makeServer({ fixed_price: true }),
      makeServer({ id: 2, fixed_price: false }),
    ];
    expect(filterAuctionServers(servers, { fixedPrice: true })).toHaveLength(1);
    expect(filterAuctionServers(servers, { fixedPrice: false })).toHaveLength(
      1
    );
  });

  it("should filter by maxSetupPrice", () => {
    const servers = [
      makeServer({ setup_price: 0 }),
      makeServer({ id: 2, setup_price: 50 }),
    ];
    const result = filterAuctionServers(servers, { maxSetupPrice: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].setup_price).toBe(0);
  });

  it("should filter by minCpuCount", () => {
    const servers = [
      makeServer({ cpu_count: 1 }),
      makeServer({ id: 2, cpu_count: 2 }),
    ];
    const result = filterAuctionServers(servers, { minCpuCount: 2 });
    expect(result).toHaveLength(1);
    expect(result[0].cpu_count).toBe(2);
  });

  it("should filter by text search", () => {
    const servers = [
      makeServer({ description: ["Intel Core i7-6700", "2x SSD"] }),
      makeServer({ id: 2, description: ["AMD Ryzen 5 3600", "4x NVMe"] }),
    ];
    const result = filterAuctionServers(servers, { text: "nvme" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it("should filter by maxHourlyPrice", () => {
    const servers = [
      makeServer({ hourly_price: 0.03 }),
      makeServer({ id: 2, hourly_price: 0.08 }),
    ];
    const result = filterAuctionServers(servers, { maxHourlyPrice: 0.05 });
    expect(result).toHaveLength(1);
    expect(result[0].hourly_price).toBe(0.03);
  });

  it("should filter by maxDiskSize", () => {
    const servers = [
      makeServer({
        serverDiskData: { nvme: [512, 512], sata: [], hdd: [], general: [] },
      }),
      makeServer({
        id: 2,
        serverDiskData: { nvme: [2000, 2000], sata: [], hdd: [], general: [] },
      }),
    ];
    const result = filterAuctionServers(servers, { maxDiskSize: 2000 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("should filter by maxDiskCount", () => {
    const servers = [
      makeServer({ hdd_count: 2 }),
      makeServer({ id: 2, hdd_count: 6 }),
    ];
    const result = filterAuctionServers(servers, { maxDiskCount: 4 });
    expect(result).toHaveLength(1);
    expect(result[0].hdd_count).toBe(2);
  });

  it("should filter by maxCpuCount", () => {
    const servers = [
      makeServer({ cpu_count: 1 }),
      makeServer({ id: 2, cpu_count: 2 }),
    ];
    const result = filterAuctionServers(servers, { maxCpuCount: 1 });
    expect(result).toHaveLength(1);
    expect(result[0].cpu_count).toBe(1);
  });

  it("should filter by minBandwidth", () => {
    const servers = [
      makeServer({ bandwidth: 1000 }),
      makeServer({ id: 2, bandwidth: 10_000 }),
    ];
    const result = filterAuctionServers(servers, { minBandwidth: 5000 });
    expect(result).toHaveLength(1);
    expect(result[0].bandwidth).toBe(10_000);
  });

  it("should filter by highio", () => {
    const servers = [
      makeServer({ is_highio: false }),
      makeServer({ id: 2, is_highio: true }),
    ];
    const result = filterAuctionServers(servers, { highio: true });
    expect(result).toHaveLength(1);
    expect(result[0].is_highio).toBe(true);
  });

  it("should filter by specials substring", () => {
    const servers = [
      makeServer({ specials: ["iNIC"] }),
      makeServer({ id: 2, specials: ["GPU", "HWR"] }),
      makeServer({ id: 3, specials: [] }),
    ];
    const result = filterAuctionServers(servers, { specials: "HWR" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it("should handle empty server array", () => {
    const result = filterAuctionServers([], { maxPrice: 50 });
    expect(result).toHaveLength(0);
  });

  it("should combine multiple filters", () => {
    const servers = [
      makeServer({ price: 20, ram_size: 32, is_ecc: true }),
      makeServer({ id: 2, price: 40, ram_size: 64, is_ecc: false }),
      makeServer({ id: 3, price: 40, ram_size: 64, is_ecc: true }),
    ];
    const result = filterAuctionServers(servers, {
      minPrice: 30,
      minRam: 48,
      ecc: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(3);
  });

  // === Boundary / edge case tests ===

  it("should include server at exact minPrice boundary", () => {
    const servers = [makeServer({ price: 50 })];
    expect(filterAuctionServers(servers, { minPrice: 50 })).toHaveLength(1);
  });

  it("should include server at exact maxPrice boundary", () => {
    const servers = [makeServer({ price: 50 })];
    expect(filterAuctionServers(servers, { maxPrice: 50 })).toHaveLength(1);
  });

  it("should include server at exact minRam boundary", () => {
    const servers = [makeServer({ ram_size: 64 })];
    expect(filterAuctionServers(servers, { minRam: 64 })).toHaveLength(1);
  });

  it("should include server at exact maxRam boundary", () => {
    const servers = [makeServer({ ram_size: 64 })];
    expect(filterAuctionServers(servers, { maxRam: 64 })).toHaveLength(1);
  });

  it("should include server at exact maxHourlyPrice boundary", () => {
    const servers = [makeServer({ hourly_price: 0.05 })];
    expect(
      filterAuctionServers(servers, { maxHourlyPrice: 0.05 })
    ).toHaveLength(1);
  });

  it("should include server at exact minDiskSize boundary", () => {
    const servers = [
      makeServer({
        serverDiskData: { nvme: [500, 500], sata: [], hdd: [], general: [] },
      }),
    ];
    expect(filterAuctionServers(servers, { minDiskSize: 1000 })).toHaveLength(
      1
    );
  });

  it("should include server at exact maxDiskSize boundary", () => {
    const servers = [
      makeServer({
        serverDiskData: { nvme: [500, 500], sata: [], hdd: [], general: [] },
      }),
    ];
    expect(filterAuctionServers(servers, { maxDiskSize: 1000 })).toHaveLength(
      1
    );
  });

  it("should include server at exact minDiskCount boundary", () => {
    const servers = [makeServer({ hdd_count: 4 })];
    expect(filterAuctionServers(servers, { minDiskCount: 4 })).toHaveLength(1);
  });

  it("should include server at exact maxDiskCount boundary", () => {
    const servers = [makeServer({ hdd_count: 4 })];
    expect(filterAuctionServers(servers, { maxDiskCount: 4 })).toHaveLength(1);
  });

  it("should include server at exact minCpuCount boundary", () => {
    const servers = [makeServer({ cpu_count: 2 })];
    expect(filterAuctionServers(servers, { minCpuCount: 2 })).toHaveLength(1);
  });

  it("should include server at exact maxCpuCount boundary", () => {
    const servers = [makeServer({ cpu_count: 2 })];
    expect(filterAuctionServers(servers, { maxCpuCount: 2 })).toHaveLength(1);
  });

  it("should include server at exact maxSetupPrice boundary", () => {
    const servers = [makeServer({ setup_price: 50 })];
    expect(filterAuctionServers(servers, { maxSetupPrice: 50 })).toHaveLength(
      1
    );
  });

  it("should include server at exact minBandwidth boundary", () => {
    const servers = [makeServer({ bandwidth: 1000 })];
    expect(filterAuctionServers(servers, { minBandwidth: 1000 })).toHaveLength(
      1
    );
  });

  it("minDiskSize should sum across all disk types", () => {
    const servers = [
      makeServer({
        serverDiskData: { nvme: [256], sata: [256], hdd: [512], general: [] },
      }),
    ];
    // total = 1024
    expect(filterAuctionServers(servers, { minDiskSize: 1024 })).toHaveLength(
      1
    );
    expect(filterAuctionServers(servers, { minDiskSize: 1025 })).toHaveLength(
      0
    );
  });

  it("maxDiskSize should sum across all disk types", () => {
    const servers = [
      makeServer({
        serverDiskData: { nvme: [256], sata: [256], hdd: [512], general: [] },
      }),
    ];
    expect(filterAuctionServers(servers, { maxDiskSize: 1024 })).toHaveLength(
      1
    );
    expect(filterAuctionServers(servers, { maxDiskSize: 1023 })).toHaveLength(
      0
    );
  });

  it("diskType should match any disk of that type present", () => {
    const server = makeServer({
      serverDiskData: { nvme: [256], sata: [512], hdd: [], general: [] },
    });
    expect(filterAuctionServers([server], { diskType: "nvme" })).toHaveLength(
      1
    );
    expect(filterAuctionServers([server], { diskType: "sata" })).toHaveLength(
      1
    );
    expect(filterAuctionServers([server], { diskType: "hdd" })).toHaveLength(0);
  });

  it("cpu filter should be case insensitive both ways", () => {
    const servers = [makeServer({ cpu: "AMD EPYC 7502P" })];
    expect(filterAuctionServers(servers, { cpu: "epyc" })).toHaveLength(1);
    expect(filterAuctionServers(servers, { cpu: "EPYC" })).toHaveLength(1);
    expect(filterAuctionServers(servers, { cpu: "Epyc" })).toHaveLength(1);
  });

  it("datacenter filter should be case insensitive", () => {
    const servers = [makeServer({ datacenter: "HEL1-DC4" })];
    expect(filterAuctionServers(servers, { datacenter: "hel" })).toHaveLength(
      1
    );
    expect(filterAuctionServers(servers, { datacenter: "HEL" })).toHaveLength(
      1
    );
  });

  it("specials filter should be case insensitive", () => {
    const servers = [makeServer({ specials: ["GPU", "iNIC"] })];
    expect(filterAuctionServers(servers, { specials: "gpu" })).toHaveLength(1);
    expect(filterAuctionServers(servers, { specials: "GPU" })).toHaveLength(1);
    expect(filterAuctionServers(servers, { specials: "inic" })).toHaveLength(1);
  });

  it("text search should be case insensitive", () => {
    const servers = [makeServer({ description: ["2x NVMe SSD 1 TB"] })];
    expect(filterAuctionServers(servers, { text: "NVME" })).toHaveLength(1);
    expect(filterAuctionServers(servers, { text: "nvme" })).toHaveLength(1);
  });

  it("text search should match across multiple description lines", () => {
    const servers = [
      makeServer({ description: ["Intel Core i7-6700", "4x NVMe 1 TB"] }),
    ];
    expect(filterAuctionServers(servers, { text: "i7" })).toHaveLength(1);
    expect(filterAuctionServers(servers, { text: "nvme" })).toHaveLength(1);
  });

  it("gpu=false should exclude GPU servers", () => {
    const servers = [
      makeServer({ specials: ["GPU"] }),
      makeServer({ id: 2, specials: [] }),
    ];
    const result = filterAuctionServers(servers, { gpu: false });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it("inic=false should exclude iNIC servers", () => {
    const servers = [
      makeServer({ specials: ["iNIC"] }),
      makeServer({ id: 2, specials: [] }),
    ];
    const result = filterAuctionServers(servers, { inic: false });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it("ecc=false should only return non-ECC servers", () => {
    const servers = [
      makeServer({ is_ecc: true }),
      makeServer({ id: 2, is_ecc: false }),
    ];
    const result = filterAuctionServers(servers, { ecc: false });
    expect(result).toHaveLength(1);
    expect(result[0].is_ecc).toBe(false);
  });

  it("should handle all filters simultaneously", () => {
    const target = makeServer({
      id: 99,
      price: 45,
      hourly_price: 0.06,
      ram_size: 128,
      cpu: "AMD EPYC 7502P",
      cpu_count: 1,
      datacenter: "HEL1-DC4",
      hdd_count: 4,
      bandwidth: 1000,
      is_ecc: true,
      is_highio: false,
      setup_price: 0,
      fixed_price: true,
      specials: ["iNIC", "ECC"],
      serverDiskData: {
        nvme: [1000, 1000, 1000, 1000],
        sata: [],
        hdd: [],
        general: [],
      },
      description: ["AMD EPYC 7502P", "4x NVMe 1 TB"],
    });
    const decoy = makeServer({ id: 1, price: 500, ram_size: 16 });

    const result = filterAuctionServers([target, decoy], {
      minPrice: 40,
      maxPrice: 50,
      maxHourlyPrice: 0.07,
      minRam: 64,
      maxRam: 256,
      cpu: "epyc",
      datacenter: "HEL",
      minDiskSize: 3000,
      maxDiskSize: 5000,
      minDiskCount: 3,
      maxDiskCount: 6,
      diskType: "nvme",
      minBandwidth: 1000,
      ecc: true,
      inic: true,
      fixedPrice: true,
      maxSetupPrice: 0,
      minCpuCount: 1,
      maxCpuCount: 2,
      specials: "ECC",
      text: "nvme",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(99);
  });
});

describe("sortAuctionServers", () => {
  const servers = [
    makeServer({ id: 1, price: 30, ram_size: 64, cpu: "Intel i7" }),
    makeServer({ id: 2, price: 20, ram_size: 32, cpu: "AMD Ryzen" }),
    makeServer({ id: 3, price: 50, ram_size: 128, cpu: "Intel i9" }),
  ];

  it("should sort by price ascending", () => {
    const result = sortAuctionServers(servers, "price", false);
    expect(result.map((s) => s.price)).toEqual([20, 30, 50]);
  });

  it("should sort by price descending", () => {
    const result = sortAuctionServers(servers, "price", true);
    expect(result.map((s) => s.price)).toEqual([50, 30, 20]);
  });

  it("should sort by ram", () => {
    const result = sortAuctionServers(servers, "ram", false);
    expect(result.map((s) => s.ram_size)).toEqual([32, 64, 128]);
  });

  it("should sort by cpu alphabetically", () => {
    const result = sortAuctionServers(servers, "cpu", false);
    expect(result.map((s) => s.cpu)).toEqual([
      "AMD Ryzen",
      "Intel i7",
      "Intel i9",
    ]);
  });

  it("should sort by datacenter", () => {
    const sorted = sortAuctionServers(
      [
        makeServer({ datacenter: "NBG1" }),
        makeServer({ id: 2, datacenter: "FSN1" }),
        makeServer({ id: 3, datacenter: "HEL1" }),
      ],
      "datacenter",
      false
    );
    expect(sorted.map((s) => s.datacenter)).toEqual(["FSN1", "HEL1", "NBG1"]);
  });

  it("should sort by disk", () => {
    const sorted = sortAuctionServers(
      [
        makeServer({
          id: 1,
          serverDiskData: { nvme: [512], sata: [], hdd: [], general: [] },
        }),
        makeServer({
          id: 2,
          serverDiskData: {
            nvme: [2000, 2000],
            sata: [],
            hdd: [],
            general: [],
          },
        }),
        makeServer({
          id: 3,
          serverDiskData: { nvme: [], sata: [256], hdd: [], general: [] },
        }),
      ],
      "disk",
      false
    );
    expect(sorted.map((s) => s.id)).toEqual([3, 1, 2]);
  });

  it("should sort by hourly price", () => {
    const sorted = sortAuctionServers(
      [
        makeServer({ id: 1, hourly_price: 0.05 }),
        makeServer({ id: 2, hourly_price: 0.02 }),
        makeServer({ id: 3, hourly_price: 0.08 }),
      ],
      "hourly",
      false
    );
    expect(sorted.map((s) => s.hourly_price)).toEqual([0.02, 0.05, 0.08]);
  });

  it("should sort by setup price", () => {
    const sorted = sortAuctionServers(
      [
        makeServer({ id: 1, setup_price: 50 }),
        makeServer({ id: 2, setup_price: 0 }),
        makeServer({ id: 3, setup_price: 99 }),
      ],
      "setup",
      false
    );
    expect(sorted.map((s) => s.setup_price)).toEqual([0, 50, 99]);
  });

  it("should sort by cpu_count", () => {
    const sorted = sortAuctionServers(
      [
        makeServer({ id: 1, cpu_count: 2 }),
        makeServer({ id: 2, cpu_count: 1 }),
        makeServer({ id: 3, cpu_count: 4 }),
      ],
      "cpu_count",
      false
    );
    expect(sorted.map((s) => s.cpu_count)).toEqual([1, 2, 4]);
  });

  it("should sort by disk_count", () => {
    const sorted = sortAuctionServers(
      [
        makeServer({ id: 1, hdd_count: 4 }),
        makeServer({ id: 2, hdd_count: 2 }),
        makeServer({ id: 3, hdd_count: 8 }),
      ],
      "disk_count",
      false
    );
    expect(sorted.map((s) => s.hdd_count)).toEqual([2, 4, 8]);
  });

  it("should sort by bandwidth", () => {
    const sorted = sortAuctionServers(
      [
        makeServer({ id: 1, bandwidth: 10_000 }),
        makeServer({ id: 2, bandwidth: 1000 }),
        makeServer({ id: 3, bandwidth: 20_000 }),
      ],
      "bandwidth",
      false
    );
    expect(sorted.map((s) => s.bandwidth)).toEqual([1000, 10_000, 20_000]);
  });

  it("should sort by next_reduce", () => {
    const sorted = sortAuctionServers(
      [
        makeServer({ id: 1, next_reduce: 90 }),
        makeServer({ id: 2, next_reduce: 15 }),
        makeServer({ id: 3, next_reduce: 45 }),
      ],
      "next_reduce",
      false
    );
    expect(sorted.map((s) => s.next_reduce)).toEqual([15, 45, 90]);
  });

  it("should not mutate the original array", () => {
    const original = [...servers];
    sortAuctionServers(servers, "price", false);
    expect(servers.map((s) => s.id)).toEqual(original.map((s) => s.id));
  });

  it("should default to price sort for unknown field", () => {
    const result = sortAuctionServers(servers, "unknown", false);
    expect(result.map((s) => s.price)).toEqual([20, 30, 50]);
  });
});
