/**
 * E2E tests for auction module using the real Hetzner auction API.
 *
 * These tests hit https://www.hetzner.com/_resources/app/data/app/live_data_sb_EUR.json
 * and validate against known invariants of the auction data (ranges, structure,
 * filter/sort correctness). Assertions use ranges and minimum counts rather than
 * specific server IDs since the auction inventory rotates continuously.
 *
 * Current live data characteristics (as of May 2026):
 *   ~400+ servers, price 38-445 EUR, RAM 32-1024 GB, disks 240-231680 GB total,
 *   datacenters: FSN1-*, HEL1-*, NBG1-*, specials: ECC, GPU, IPv4, iNIC,
 *   ~20 GPU servers, many ECC servers, fixed-price and auction inventory,
 *   all bandwidth 1000 Mbit/s, all setup_price 0
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  fetchAuctionServers,
  filterAuctionServers,
  sortAuctionServers,
} from "./client.js";
import { formatAuctionDetails, formatAuctionList } from "./formatter.js";
import type { AuctionResponse, AuctionServer } from "./types.js";

const FSN_PREFIX_REGEX = /^FSN/;
const HEL_PREFIX_REGEX = /^HEL/;
const TIME_FORMAT_REGEX = /\d+[hm]/;
const RUN_LIVE_AUCTION_E2E = process.env.HCTL_RUN_AUCTION_E2E === "1";
const describeLiveAuction = RUN_LIVE_AUCTION_E2E ? describe : describe.skip;

let data: AuctionResponse;
let servers: AuctionServer[];

if (RUN_LIVE_AUCTION_E2E) {
  beforeAll(async () => {
    data = await fetchAuctionServers("EUR", { source: "direct" });
    servers = data.server;
  }, 15_000);
}

// ============================================================================
// API Response Structure
// ============================================================================

describeLiveAuction("e2e: API response structure", () => {
  it("should return a non-empty server array", () => {
    expect(servers.length).toBeGreaterThan(300);
    expect(data.serverCount).toBeGreaterThan(0);
  });

  it("every server should have required fields with correct types", () => {
    for (const s of servers) {
      expect(typeof s.id).toBe("number");
      expect(typeof s.key).toBe("number");
      expect(typeof s.name).toBe("string");
      expect(Array.isArray(s.description)).toBe(true);
      expect(typeof s.cpu).toBe("string");
      expect(typeof s.cpu_count).toBe("number");
      expect(typeof s.is_highio).toBe("boolean");
      expect(typeof s.is_ecc).toBe("boolean");
      expect(typeof s.traffic).toBe("string");
      expect(typeof s.bandwidth).toBe("number");
      expect(Array.isArray(s.ram)).toBe(true);
      expect(typeof s.ram_size).toBe("number");
      expect(typeof s.price).toBe("number");
      expect(typeof s.setup_price).toBe("number");
      expect(typeof s.hourly_price).toBe("number");
      expect(Array.isArray(s.hdd_arr)).toBe(true);
      expect(Array.isArray(s.hdd_hr)).toBe(true);
      expect(typeof s.hdd_size).toBe("number");
      expect(typeof s.hdd_count).toBe("number");
      expect(s.serverDiskData).toBeDefined();
      expect(Array.isArray(s.serverDiskData.nvme)).toBe(true);
      expect(Array.isArray(s.serverDiskData.sata)).toBe(true);
      expect(Array.isArray(s.serverDiskData.hdd)).toBe(true);
      expect(typeof s.datacenter).toBe("string");
      expect(typeof s.datacenter_hr).toBe("string");
      expect(Array.isArray(s.specials)).toBe(true);
      expect(Array.isArray(s.dist)).toBe(true);
      expect(typeof s.fixed_price).toBe("boolean");
      expect(typeof s.next_reduce).toBe("number");
      expect(typeof s.next_reduce_timestamp).toBe("number");
      expect(typeof s.ip_price).toBe("object");
      expect(typeof s.ip_price.Monthly).toBe("number");
      expect(typeof s.ip_price.Hourly).toBe("number");
    }
  });

  it("all server IDs should be unique", () => {
    const ids = servers.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every server should have at least one disk type populated", () => {
    for (const s of servers) {
      const totalDisks =
        s.serverDiskData.nvme.length +
        s.serverDiskData.sata.length +
        s.serverDiskData.hdd.length +
        s.serverDiskData.general.length;
      expect(totalDisks).toBeGreaterThan(0);
    }
  });

  it("disk sizes should all be positive numbers", () => {
    for (const s of servers) {
      for (const d of [
        ...s.serverDiskData.nvme,
        ...s.serverDiskData.sata,
        ...s.serverDiskData.hdd,
      ]) {
        expect(d).toBeGreaterThan(0);
      }
    }
  });

  it("prices should be positive", () => {
    for (const s of servers) {
      expect(s.price).toBeGreaterThan(0);
      expect(s.hourly_price).toBeGreaterThan(0);
      expect(s.setup_price).toBeGreaterThanOrEqual(0);
    }
  });

  it("datacenters should match known Hetzner locations", () => {
    const knownPrefixes = ["FSN1", "HEL1", "NBG1"];
    for (const s of servers) {
      const matchesKnown = knownPrefixes.some((p) =>
        s.datacenter.startsWith(p)
      );
      expect(matchesKnown).toBe(true);
    }
  });

  it("specials should only contain known values", () => {
    const knownSpecials = new Set(["ECC", "GPU", "IPv4", "iNIC", "HWR"]);
    for (const s of servers) {
      for (const sp of s.specials) {
        expect(knownSpecials.has(sp)).toBe(true);
      }
    }
  });
});

// ============================================================================
// Data Range Invariants
// ============================================================================

describeLiveAuction("e2e: data range invariants", () => {
  it("price range should span the current auction range", () => {
    const prices = servers.map((s) => s.price);
    expect(Math.min(...prices)).toBeLessThanOrEqual(45);
    expect(Math.max(...prices)).toBeGreaterThanOrEqual(300);
  });

  it("RAM range should span at least 32-512 GB", () => {
    const rams = servers.map((s) => s.ram_size);
    expect(Math.min(...rams)).toBeLessThanOrEqual(32);
    expect(Math.max(...rams)).toBeGreaterThanOrEqual(512);
  });

  it("should have both Intel and AMD CPUs", () => {
    const intel = servers.filter((s) => s.cpu.toLowerCase().includes("intel"));
    const amd = servers.filter((s) => s.cpu.toLowerCase().includes("amd"));
    expect(intel.length).toBeGreaterThan(100);
    expect(amd.length).toBeGreaterThan(100);
  });

  it("should have servers in all three Hetzner regions", () => {
    const fsn = servers.filter((s) => s.datacenter.startsWith("FSN1"));
    const hel = servers.filter((s) => s.datacenter.startsWith("HEL1"));
    const nbg = servers.filter((s) => s.datacenter.startsWith("NBG1"));
    expect(fsn.length).toBeGreaterThan(0);
    expect(hel.length).toBeGreaterThan(0);
    expect(nbg.length).toBeGreaterThan(0);
  });

  it("should have all three disk types represented", () => {
    const nvme = servers.filter((s) => s.serverDiskData.nvme.length > 0);
    const sata = servers.filter((s) => s.serverDiskData.sata.length > 0);
    const hdd = servers.filter((s) => s.serverDiskData.hdd.length > 0);
    expect(nvme.length).toBeGreaterThan(50);
    expect(sata.length).toBeGreaterThan(50);
    expect(hdd.length).toBeGreaterThan(50);
  });

  it("should have both ECC and non-ECC servers", () => {
    const ecc = servers.filter((s) => s.is_ecc);
    const nonEcc = servers.filter((s) => !s.is_ecc);
    expect(ecc.length).toBeGreaterThan(100);
    expect(nonEcc.length).toBeGreaterThan(100);
  });

  it("should have both fixed-price and auction servers", () => {
    const fixed = servers.filter((s) => s.fixed_price);
    const auction = servers.filter((s) => !s.fixed_price);
    expect(fixed.length).toBeGreaterThan(0);
    expect(auction.length).toBeGreaterThan(100);
  });

  it("should have GPU servers", () => {
    const gpu = servers.filter((s) => s.specials.includes("GPU"));
    expect(gpu.length).toBeGreaterThan(5);
  });

  it("should have iNIC servers", () => {
    const inic = servers.filter((s) => s.specials.includes("iNIC"));
    expect(inic.length).toBeGreaterThan(100);
  });

  it("should have mixed-disk-type servers", () => {
    const mixed = servers.filter((s) => {
      const types = [
        s.serverDiskData.nvme.length > 0,
        s.serverDiskData.sata.length > 0,
        s.serverDiskData.hdd.length > 0,
      ].filter(Boolean).length;
      return types > 1;
    });
    expect(mixed.length).toBeGreaterThan(50);
  });

  it("disk count range should include at least 1-8", () => {
    const counts = servers.map((s) => s.hdd_count);
    expect(Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(8);
  });
});

// ============================================================================
// Filtering with Real Data
// ============================================================================

describeLiveAuction("e2e: filtering real data", () => {
  it("maxPrice should reduce result count", () => {
    const all = filterAuctionServers(servers, {});
    const cheap = filterAuctionServers(servers, { maxPrice: 40 });
    expect(cheap.length).toBeLessThan(all.length);
    expect(cheap.length).toBeGreaterThan(0);
    for (const s of cheap) {
      expect(s.price).toBeLessThanOrEqual(40);
    }
  });

  it("minPrice should exclude cheapest servers", () => {
    const expensive = filterAuctionServers(servers, { minPrice: 200 });
    expect(expensive.length).toBeGreaterThan(0);
    expect(expensive.length).toBeLessThan(servers.length);
    for (const s of expensive) {
      expect(s.price).toBeGreaterThanOrEqual(200);
    }
  });

  it("price range should intersect correctly", () => {
    const range = filterAuctionServers(servers, { minPrice: 50, maxPrice: 80 });
    expect(range.length).toBeGreaterThan(0);
    for (const s of range) {
      expect(s.price).toBeGreaterThanOrEqual(50);
      expect(s.price).toBeLessThanOrEqual(80);
    }
  });

  it("maxHourlyPrice should filter correctly", () => {
    const hourlyPrices = [...new Set(servers.map((s) => s.hourly_price))].sort(
      (a, b) => a - b
    );
    const threshold = hourlyPrices[0];
    const cheap = filterAuctionServers(servers, { maxHourlyPrice: threshold });
    expect(cheap.length).toBeGreaterThan(0);
    expect(cheap.length).toBeLessThan(servers.length);
    for (const s of cheap) {
      expect(s.hourly_price).toBeLessThanOrEqual(threshold);
    }
  });

  it("minRam should filter out low-RAM servers", () => {
    const bigRam = filterAuctionServers(servers, { minRam: 128 });
    expect(bigRam.length).toBeGreaterThan(0);
    expect(bigRam.length).toBeLessThan(servers.length);
    for (const s of bigRam) {
      expect(s.ram_size).toBeGreaterThanOrEqual(128);
    }
  });

  it("maxRam should filter out high-RAM servers", () => {
    const smallRam = filterAuctionServers(servers, { maxRam: 64 });
    expect(smallRam.length).toBeGreaterThan(0);
    for (const s of smallRam) {
      expect(s.ram_size).toBeLessThanOrEqual(64);
    }
  });

  it("cpu filter should match substring case-insensitively", () => {
    const ryzen = filterAuctionServers(servers, { cpu: "ryzen" });
    expect(ryzen.length).toBeGreaterThan(0);
    for (const s of ryzen) {
      expect(s.cpu.toLowerCase()).toContain("ryzen");
    }

    const epyc = filterAuctionServers(servers, { cpu: "EPYC" });
    expect(epyc.length).toBeGreaterThan(0);
    for (const s of epyc) {
      expect(s.cpu.toLowerCase()).toContain("epyc");
    }
  });

  it("datacenter filter should match substring", () => {
    const fsn = filterAuctionServers(servers, { datacenter: "FSN" });
    expect(fsn.length).toBeGreaterThan(0);
    for (const s of fsn) {
      expect(s.datacenter).toMatch(FSN_PREFIX_REGEX);
    }

    const hel = filterAuctionServers(servers, { datacenter: "hel" });
    expect(hel.length).toBeGreaterThan(0);
    for (const s of hel) {
      expect(s.datacenter).toMatch(HEL_PREFIX_REGEX);
    }
  });

  it("diskType nvme should only return servers with NVMe drives", () => {
    const nvme = filterAuctionServers(servers, { diskType: "nvme" });
    expect(nvme.length).toBeGreaterThan(50);
    for (const s of nvme) {
      expect(s.serverDiskData.nvme.length).toBeGreaterThan(0);
    }
  });

  it("diskType sata should only return servers with SATA drives", () => {
    const sata = filterAuctionServers(servers, { diskType: "sata" });
    expect(sata.length).toBeGreaterThan(50);
    for (const s of sata) {
      expect(s.serverDiskData.sata.length).toBeGreaterThan(0);
    }
  });

  it("diskType hdd should only return servers with HDD drives", () => {
    const hdd = filterAuctionServers(servers, { diskType: "hdd" });
    expect(hdd.length).toBeGreaterThan(50);
    for (const s of hdd) {
      expect(s.serverDiskData.hdd.length).toBeGreaterThan(0);
    }
  });

  it("minDiskSize should filter by total disk capacity", () => {
    const big = filterAuctionServers(servers, { minDiskSize: 10_000 });
    expect(big.length).toBeGreaterThan(0);
    for (const s of big) {
      const total = [
        ...s.serverDiskData.nvme,
        ...s.serverDiskData.sata,
        ...s.serverDiskData.hdd,
      ].reduce((sum, d) => sum + d, 0);
      expect(total).toBeGreaterThanOrEqual(10_000);
    }
  });

  it("maxDiskSize should cap total disk capacity", () => {
    const small = filterAuctionServers(servers, { maxDiskSize: 1000 });
    expect(small.length).toBeGreaterThan(0);
    for (const s of small) {
      const total = [
        ...s.serverDiskData.nvme,
        ...s.serverDiskData.sata,
        ...s.serverDiskData.hdd,
      ].reduce((sum, d) => sum + d, 0);
      expect(total).toBeLessThanOrEqual(1000);
    }
  });

  it("minDiskCount should filter by drive count", () => {
    const many = filterAuctionServers(servers, { minDiskCount: 4 });
    expect(many.length).toBeGreaterThan(0);
    for (const s of many) {
      expect(s.hdd_count).toBeGreaterThanOrEqual(4);
    }
  });

  it("maxDiskCount should cap drive count", () => {
    const few = filterAuctionServers(servers, { maxDiskCount: 2 });
    expect(few.length).toBeGreaterThan(0);
    for (const s of few) {
      expect(s.hdd_count).toBeLessThanOrEqual(2);
    }
  });

  it("ecc filter should only return ECC servers", () => {
    const ecc = filterAuctionServers(servers, { ecc: true });
    expect(ecc.length).toBeGreaterThan(100);
    for (const s of ecc) {
      expect(s.is_ecc).toBe(true);
    }
  });

  it("gpu filter should only return GPU servers", () => {
    const gpu = filterAuctionServers(servers, { gpu: true });
    expect(gpu.length).toBeGreaterThan(5);
    for (const s of gpu) {
      expect(s.specials).toContain("GPU");
    }
  });

  it("inic filter should only return iNIC servers", () => {
    const inic = filterAuctionServers(servers, { inic: true });
    expect(inic.length).toBeGreaterThan(100);
    for (const s of inic) {
      expect(s.specials).toContain("iNIC");
    }
  });

  it("specials filter should match substring", () => {
    const gpu = filterAuctionServers(servers, { specials: "gpu" });
    expect(gpu.length).toBeGreaterThan(0);
    for (const s of gpu) {
      expect(s.specials.some((sp) => sp.toLowerCase().includes("gpu"))).toBe(
        true
      );
    }
  });

  it("fixedPrice filter should correctly split inventory", () => {
    const fixed = filterAuctionServers(servers, { fixedPrice: true });
    const auction = filterAuctionServers(servers, { fixedPrice: false });
    expect(fixed.length + auction.length).toBe(servers.length);
    for (const s of fixed) {
      expect(s.fixed_price).toBe(true);
    }
    for (const s of auction) {
      expect(s.fixed_price).toBe(false);
    }
  });

  it("text search should match description content", () => {
    const nvmeDesc = filterAuctionServers(servers, { text: "nvme" });
    expect(nvmeDesc.length).toBeGreaterThan(0);
    for (const s of nvmeDesc) {
      expect(s.description.join(" ").toLowerCase()).toContain("nvme");
    }
  });

  it("combined filters should narrow results progressively", () => {
    const step1 = filterAuctionServers(servers, { maxPrice: 100 });
    const step2 = filterAuctionServers(servers, { maxPrice: 100, minRam: 64 });
    const step3 = filterAuctionServers(servers, {
      maxPrice: 100,
      minRam: 64,
      ecc: true,
    });
    const step4 = filterAuctionServers(servers, {
      maxPrice: 100,
      minRam: 64,
      ecc: true,
      diskType: "nvme",
    });

    expect(step1.length).toBeLessThanOrEqual(servers.length);
    expect(step2.length).toBeLessThanOrEqual(step1.length);
    expect(step3.length).toBeLessThanOrEqual(step2.length);
    expect(step4.length).toBeLessThanOrEqual(step3.length);
    // At least one filter should have meaningfully reduced the count
    expect(step4.length).toBeLessThan(servers.length);
  });

  it("aggressive filter combination should yield few or no results", () => {
    const result = filterAuctionServers(servers, {
      maxPrice: 30,
      minRam: 512,
      gpu: true,
      diskType: "nvme",
    });
    // Such specific criteria should yield very few results
    expect(result.length).toBeLessThan(5);
  });

  it("impossible filter combination should yield zero results", () => {
    const result = filterAuctionServers(servers, {
      maxPrice: 10, // nothing is this cheap
    });
    expect(result.length).toBe(0);
  });

  it("no filters should return all servers", () => {
    const all = filterAuctionServers(servers, {});
    expect(all.length).toBe(servers.length);
  });
});

// ============================================================================
// Sorting with Real Data
// ============================================================================

describeLiveAuction("e2e: sorting real data", () => {
  it("sort by price ascending should be ordered", () => {
    const sorted = sortAuctionServers(servers, "price", false);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].price).toBeGreaterThanOrEqual(sorted[i - 1].price);
    }
  });

  it("sort by price descending should be reverse ordered", () => {
    const sorted = sortAuctionServers(servers, "price", true);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].price).toBeLessThanOrEqual(sorted[i - 1].price);
    }
  });

  it("sort by hourly ascending should be ordered", () => {
    const sorted = sortAuctionServers(servers, "hourly", false);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].hourly_price).toBeGreaterThanOrEqual(
        sorted[i - 1].hourly_price
      );
    }
  });

  it("sort by ram ascending should be ordered", () => {
    const sorted = sortAuctionServers(servers, "ram", false);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].ram_size).toBeGreaterThanOrEqual(sorted[i - 1].ram_size);
    }
  });

  it("sort by ram descending should be reverse ordered", () => {
    const sorted = sortAuctionServers(servers, "ram", true);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].ram_size).toBeLessThanOrEqual(sorted[i - 1].ram_size);
    }
  });

  it("sort by disk total ascending should be ordered", () => {
    const totalDisk = (s: AuctionServer) =>
      [
        ...s.serverDiskData.nvme,
        ...s.serverDiskData.sata,
        ...s.serverDiskData.hdd,
      ].reduce((a, b) => a + b, 0);
    const sorted = sortAuctionServers(servers, "disk", false);
    for (let i = 1; i < sorted.length; i++) {
      expect(totalDisk(sorted[i])).toBeGreaterThanOrEqual(
        totalDisk(sorted[i - 1])
      );
    }
  });

  it("sort by disk_count ascending should be ordered", () => {
    const sorted = sortAuctionServers(servers, "disk_count", false);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].hdd_count).toBeGreaterThanOrEqual(
        sorted[i - 1].hdd_count
      );
    }
  });

  it("sort by cpu alphabetical should be ordered", () => {
    const sorted = sortAuctionServers(servers, "cpu", false);
    for (let i = 1; i < sorted.length; i++) {
      expect(
        sorted[i].cpu.localeCompare(sorted[i - 1].cpu)
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it("sort by datacenter should be ordered", () => {
    const sorted = sortAuctionServers(servers, "datacenter", false);
    for (let i = 1; i < sorted.length; i++) {
      expect(
        sorted[i].datacenter.localeCompare(sorted[i - 1].datacenter)
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it("sort by next_reduce ascending should be ordered", () => {
    const sorted = sortAuctionServers(servers, "next_reduce", false);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].next_reduce).toBeGreaterThanOrEqual(
        sorted[i - 1].next_reduce
      );
    }
  });

  it("sorting should not mutate the original array", () => {
    const originalIds = servers.map((s) => s.id);
    sortAuctionServers(servers, "price", false);
    expect(servers.map((s) => s.id)).toEqual(originalIds);
  });

  it("sort + filter should work together", () => {
    const filtered = filterAuctionServers(servers, { maxPrice: 60, ecc: true });
    const sorted = sortAuctionServers(filtered, "ram", true);
    expect(sorted.length).toBeGreaterThan(0);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].ram_size).toBeLessThanOrEqual(sorted[i - 1].ram_size);
    }
    for (const s of sorted) {
      expect(s.price).toBeLessThanOrEqual(60);
      expect(s.is_ecc).toBe(true);
    }
  });
});

// ============================================================================
// Formatting with Real Data
// ============================================================================

describeLiveAuction("e2e: formatting real data", () => {
  it("formatAuctionList should render all servers without error", () => {
    const output = formatAuctionList(servers);
    expect(output).toContain("server(s) found");
    expect(output).toContain(servers.length.toString());
  });

  it("formatAuctionList should render filtered subset", () => {
    const gpu = filterAuctionServers(servers, { gpu: true });
    const output = formatAuctionList(gpu);
    expect(output).toContain(`${gpu.length} server(s) found`);
    expect(output).toContain("GPU");
  });

  it("formatAuctionDetails should render the cheapest server", () => {
    const sorted = sortAuctionServers(servers, "price", false);
    const cheapest = sorted[0];
    const output = formatAuctionDetails(cheapest);
    expect(output).toContain(`Auction Server ${cheapest.id}`);
    expect(output).toContain(cheapest.cpu);
    expect(output).toContain(`${cheapest.ram_size} GB`);
    expect(output).toContain(cheapest.datacenter);
    expect(output).toContain(cheapest.price.toFixed(2));
  });

  it("formatAuctionDetails should render the most expensive server", () => {
    const sorted = sortAuctionServers(servers, "price", true);
    const priciest = sorted[0];
    const output = formatAuctionDetails(priciest);
    expect(output).toContain(`Auction Server ${priciest.id}`);
    expect(output).toContain(priciest.cpu);
    expect(output).toContain(priciest.price.toFixed(2));
  });

  it("formatAuctionDetails should handle GPU server with specials", () => {
    const gpu = filterAuctionServers(servers, { gpu: true });
    expect(gpu.length).toBeGreaterThan(0);
    const output = formatAuctionDetails(gpu[0]);
    expect(output).toContain("GPU");
    expect(output).not.toContain("None"); // specials should not be "None"
  });

  it("formatAuctionDetails should render servers with mixed disk types", () => {
    const mixed = servers.find((s) => {
      const types = [
        s.serverDiskData.nvme.length > 0,
        s.serverDiskData.sata.length > 0,
        s.serverDiskData.hdd.length > 0,
      ].filter(Boolean).length;
      return types > 1;
    });
    expect(mixed).toBeDefined();
    const output = formatAuctionDetails(mixed as AuctionServer);
    expect(output).toContain("Disk Breakdown");
  });

  it("formatAuctionDetails should render auction server with next_reduce", () => {
    const auctionServers = filterAuctionServers(servers, { fixedPrice: false });
    const withReduce = auctionServers.find((s) => s.next_reduce > 0);
    expect(withReduce).toBeDefined();
    const output = formatAuctionDetails(withReduce as AuctionServer);
    expect(output).toContain("Auction");
    // Should show time format (Xh Ym or Ym)
    expect(output).toMatch(TIME_FORMAT_REGEX);
  });

  it("formatAuctionDetails should render high-RAM server", () => {
    const bigRam = sortAuctionServers(servers, "ram", true)[0];
    const output = formatAuctionDetails(bigRam);
    expect(output).toContain(`${bigRam.ram_size} GB`);
  });
});

// ============================================================================
// USD Currency Variant
// ============================================================================

describeLiveAuction("e2e: USD currency", () => {
  it("should fetch USD data successfully", async () => {
    const usd = await fetchAuctionServers("USD", { source: "direct" });
    expect(usd.server.length).toBeGreaterThan(300);
    // Same server count as EUR
    expect(usd.server.length).toBe(servers.length);
  }, 15_000);
});
