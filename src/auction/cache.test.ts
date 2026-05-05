import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAuctionDataWithCache } from "./cache.js";
import type { AuctionServer } from "./types.js";

const mockFetch = vi.fn();

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

function auctionResponse(server: AuctionServer): Response {
  return new Response(JSON.stringify({ server: [server], serverCount: 1 }), {
    headers: {
      "Content-Type": "application/json",
      "X-Hctl-Auction-Source": "cloudflare-r2",
      "X-Hctl-Auction-Stale": "false",
      "X-Hctl-Auction-Updated-At": "2026-05-05T15:00:00.000Z",
    },
    status: 200,
  });
}

describe("fetchAuctionDataWithCache", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `hctl-auction-cache-${process.pid}-${Date.now()}`);
    dbPath = join(tmpDir, "auction.db");
    mkdirSync(tmpDir, { recursive: true });
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T15:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    rmSync(tmpDir, { force: true, recursive: true });
  });

  it("should fall back to the latest local cache when the network fails", async () => {
    mockFetch.mockResolvedValueOnce(auctionResponse(makeServer({ id: 42 })));

    const fresh = await fetchAuctionDataWithCache("EUR", {
      allowLocalFallback: true,
      dbPath,
    });

    expect(fresh.metadata.source).toBe("cloudflare-r2");

    vi.setSystemTime(new Date("2026-05-05T15:10:00.000Z"));
    mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

    const cached = await fetchAuctionDataWithCache("EUR", {
      allowLocalFallback: true,
      dbPath,
    });

    expect(cached.data.server).toHaveLength(1);
    expect(cached.data.server[0].id).toBe(42);
    expect(cached.metadata).toMatchObject({
      ageSeconds: 600,
      source: "local-cache",
      stale: true,
      updatedAt: "2026-05-05T15:00:00.000Z",
    });
  });

  it("should explain how to seed the cache when offline with no local data", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(
      fetchAuctionDataWithCache("EUR", {
        allowLocalFallback: true,
        dbPath,
      })
    ).rejects.toThrow("No local auction cache is available yet");
  });

  it("should not use local fallback when it is disabled", async () => {
    mockFetch.mockResolvedValueOnce(auctionResponse(makeServer({ id: 42 })));
    await fetchAuctionDataWithCache("EUR", {
      allowLocalFallback: true,
      dbPath,
    });

    mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(
      fetchAuctionDataWithCache("EUR", {
        allowLocalFallback: false,
        dbPath,
      })
    ).rejects.toThrow("try again when the network is available");
  });
});
