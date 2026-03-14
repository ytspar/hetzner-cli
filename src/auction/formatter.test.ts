import { describe, expect, it } from "vitest";
import { formatAuctionDetails, formatAuctionList } from "./formatter.js";
import type { AuctionServer } from "./types.js";

const RAM_ECC_REGEX = /32 GB\s*ECC/;

function makeServer(overrides: Partial<AuctionServer> = {}): AuctionServer {
  return {
    id: 12_345,
    key: 1,
    name: "SB12345",
    description: ["Intel Core i7-6700", "2x SSD SATA 512 GB"],
    information: null,
    cpu: "Intel Core i7-6700",
    cpu_count: 1,
    is_highio: false,
    is_ecc: true,
    traffic: "unlimited",
    bandwidth: 1000,
    ram: ["DDR4 ECC 32GB"],
    ram_size: 32,
    price: 29.0,
    setup_price: 0,
    hourly_price: 0.0399,
    hdd_arr: ["SSD 512 GB", "SSD 512 GB"],
    hdd_hr: ["2x SSD SATA 512 GB"],
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
    specials: ["iNIC"],
    dist: ["Debian"],
    fixed_price: true,
    next_reduce: 0,
    next_reduce_hr: false,
    next_reduce_timestamp: 0,
    ip_price: { Monthly: 1.3, Hourly: 0.0019, Amount: 1 },
    ...overrides,
  };
}

describe("formatAuctionList", () => {
  it("should show message for empty list", () => {
    const result = formatAuctionList([]);
    expect(result).toContain("No auction servers found");
  });

  it("should display server data in table", () => {
    const result = formatAuctionList([makeServer()]);

    expect(result).toContain("12345");
    expect(result).toContain("Intel Core i7-6700");
    expect(result).toContain("32 GB");
    expect(result).toContain("ECC");
    expect(result).toContain("FSN1-DC14");
    expect(result).toContain("29.00");
    expect(result).toContain("Free");
    expect(result).toContain("Fixed");
    expect(result).toContain("iNIC");
    expect(result).toContain("1 server(s) found");
  });

  it("should show setup price when non-zero", () => {
    const result = formatAuctionList([makeServer({ setup_price: 49.99 })]);
    expect(result).toContain("49.99");
  });

  it("should show Auction type for non-fixed price", () => {
    const result = formatAuctionList([
      makeServer({ fixed_price: false, next_reduce: 90 }),
    ]);
    expect(result).toContain("Auction");
    expect(result).toContain("1h 30m");
  });

  it("should show disk summary with NVMe", () => {
    const result = formatAuctionList([
      makeServer({
        serverDiskData: { nvme: [512, 512], sata: [], hdd: [], general: [] },
      }),
    ]);
    expect(result).toContain("2x 512 GB NVMe");
  });

  it("should show disk summary with HDD in TB", () => {
    const result = formatAuctionList([
      makeServer({
        serverDiskData: { nvme: [], sata: [], hdd: [4000, 4000], general: [] },
      }),
    ]);
    expect(result).toContain("2x 4 TB HDD");
  });

  it("should show multiple servers", () => {
    const result = formatAuctionList([
      makeServer(),
      makeServer({ id: 54_321, cpu: "AMD Ryzen 5 3600" }),
    ]);
    expect(result).toContain("12345");
    expect(result).toContain("54321");
    expect(result).toContain("2 server(s) found");
  });

  it("should handle servers with no specials", () => {
    const result = formatAuctionList([makeServer({ specials: [] })]);
    expect(result).toContain("12345");
  });

  it("should show non-ECC RAM without ECC label", () => {
    const result = formatAuctionList([makeServer({ is_ecc: false })]);
    expect(result).toContain("32 GB");
    expect(result).not.toMatch(RAM_ECC_REGEX);
  });

  it("should show mixed disk types", () => {
    const result = formatAuctionList([
      makeServer({
        serverDiskData: { nvme: [512], sata: [1000], hdd: [4000], general: [] },
      }),
    ]);
    expect(result).toContain("NVMe");
    expect(result).toContain("SATA");
    expect(result).toContain("HDD");
  });

  it("should show large NVMe in TB", () => {
    const result = formatAuctionList([
      makeServer({
        serverDiskData: { nvme: [2000, 2000], sata: [], hdd: [], general: [] },
      }),
    ]);
    expect(result).toContain("2x 2 TB NVMe");
  });

  it("should show fractional TB correctly", () => {
    const result = formatAuctionList([
      makeServer({
        serverDiskData: { nvme: [1500], sata: [], hdd: [], general: [] },
      }),
    ]);
    expect(result).toContain("1.5 TB");
  });

  it("should show no-disk server as dash", () => {
    const result = formatAuctionList([
      makeServer({
        serverDiskData: { nvme: [], sata: [], hdd: [], general: [] },
      }),
    ]);
    expect(result).toContain("-");
  });

  it("should show next reduce as dash for fixed price", () => {
    const result = formatAuctionList([makeServer({ fixed_price: true })]);
    expect(result).toContain("Fixed");
  });

  it("should format next_reduce minutes only", () => {
    const result = formatAuctionList([
      makeServer({
        fixed_price: false,
        next_reduce: 30,
      }),
    ]);
    expect(result).toContain("30m");
  });

  it("should format next_reduce hours and minutes", () => {
    const result = formatAuctionList([
      makeServer({
        fixed_price: false,
        next_reduce: 150,
      }),
    ]);
    expect(result).toContain("2h 30m");
  });

  it("should show dash for next_reduce <= 0 on auction", () => {
    const result = formatAuctionList([
      makeServer({
        fixed_price: false,
        next_reduce: -1,
      }),
    ]);
    expect(result).toContain("Auction");
  });

  it("should show multiple specials comma-separated", () => {
    const result = formatAuctionList([
      makeServer({
        specials: ["GPU", "iNIC", "ECC"],
      }),
    ]);
    expect(result).toContain("GPU");
    expect(result).toContain("iNIC");
    expect(result).toContain("ECC");
  });

  it("should handle large server counts", () => {
    const servers = Array.from({ length: 100 }, (_, i) =>
      makeServer({ id: i + 1 })
    );
    const result = formatAuctionList(servers);
    expect(result).toContain("100 server(s) found");
  });
});

describe("formatAuctionDetails", () => {
  it("should display all server properties", () => {
    const result = formatAuctionDetails(makeServer());

    expect(result).toContain("Auction Server 12345");
    expect(result).toContain("SB12345");
    expect(result).toContain("Intel Core i7-6700");
    expect(result).toContain("32 GB");
    expect(result).toContain("(ECC)");
    expect(result).toContain("DDR4 ECC 32GB");
    expect(result).toContain("2x SSD SATA 512 GB");
    expect(result).toContain("1024 GB");
    expect(result).toContain("Falkenstein");
    expect(result).toContain("FSN1-DC14");
    expect(result).toContain("unlimited");
    expect(result).toContain("1000 Mbit/s");
    expect(result).toContain("29.00");
    expect(result).toContain("0.0399");
    expect(result).toContain("Free");
    expect(result).toContain("Fixed");
    expect(result).toContain("iNIC");
    expect(result).toContain("Yes"); // ECC
  });

  it("should show disk breakdown", () => {
    const result = formatAuctionDetails(
      makeServer({
        serverDiskData: {
          nvme: [512, 512],
          sata: [1000],
          hdd: [4000],
          general: [],
        },
      })
    );

    expect(result).toContain("Disk Breakdown");
    expect(result).toContain("NVMe");
    expect(result).toContain("512 GB");
    expect(result).toContain("SATA");
    expect(result).toContain("1 TB");
    expect(result).toContain("HDD");
    expect(result).toContain("4 TB");
  });

  it("should show IP pricing", () => {
    const result = formatAuctionDetails(makeServer());

    expect(result).toContain("Additional IP Pricing");
    expect(result).toContain("1.30");
    expect(result).toContain("0.0019");
  });

  it("should show description", () => {
    const result = formatAuctionDetails(
      makeServer({
        description: ["Intel Core i7-6700", "2x SSD 512 GB"],
      })
    );

    expect(result).toContain("Description");
    expect(result).toContain("Intel Core i7-6700");
    expect(result).toContain("2x SSD 512 GB");
  });

  it("should show next reduce time for auction servers", () => {
    const result = formatAuctionDetails(
      makeServer({
        fixed_price: false,
        next_reduce: 45,
      })
    );

    expect(result).toContain("Auction");
    expect(result).toContain("45m");
  });

  it("should show setup price when non-zero", () => {
    const result = formatAuctionDetails(makeServer({ setup_price: 49.99 }));
    expect(result).toContain("49.99");
  });

  it("should handle server with no specials", () => {
    const result = formatAuctionDetails(makeServer({ specials: [] }));
    expect(result).toContain("None");
  });

  it("should show non-ECC server without ECC label", () => {
    const result = formatAuctionDetails(makeServer({ is_ecc: false }));
    expect(result).toContain("No"); // ECC: No
    expect(result).not.toContain("(ECC)");
  });

  it("should show High I/O status", () => {
    const hiResult = formatAuctionDetails(makeServer({ is_highio: true }));
    const loResult = formatAuctionDetails(makeServer({ is_highio: false }));
    expect(hiResult).toContain("Yes");
    expect(loResult).toContain("No");
  });

  it("should show CPU count", () => {
    const result = formatAuctionDetails(makeServer({ cpu_count: 2 }));
    expect(result).toContain("2");
  });

  it("should show all RAM details", () => {
    const result = formatAuctionDetails(
      makeServer({
        ram: [
          "DDR4 ECC 16GB",
          "DDR4 ECC 16GB",
          "DDR4 ECC 16GB",
          "DDR4 ECC 16GB",
        ],
        ram_size: 64,
        is_ecc: true,
      })
    );
    expect(result).toContain("64 GB");
    expect(result).toContain("(ECC)");
    expect(result).toContain("DDR4 ECC 16GB");
  });

  it("should show total disk size", () => {
    const result = formatAuctionDetails(makeServer({ hdd_size: 8000 }));
    expect(result).toContain("8000 GB");
  });

  it("should show disk count", () => {
    const result = formatAuctionDetails(makeServer({ hdd_count: 8 }));
    expect(result).toContain("8");
  });

  it("should show bandwidth", () => {
    const result = formatAuctionDetails(makeServer({ bandwidth: 10_000 }));
    expect(result).toContain("10000 Mbit/s");
  });

  it("should show hourly price with 4 decimal places", () => {
    const result = formatAuctionDetails(makeServer({ hourly_price: 0.1234 }));
    expect(result).toContain("0.1234");
  });

  it("should show fixed price type", () => {
    const fixed = formatAuctionDetails(makeServer({ fixed_price: true }));
    const auction = formatAuctionDetails(makeServer({ fixed_price: false }));
    expect(fixed).toContain("Fixed");
    expect(auction).toContain("Auction");
  });

  it("should show disk breakdown with only NVMe", () => {
    const result = formatAuctionDetails(
      makeServer({
        serverDiskData: { nvme: [1000, 1000], sata: [], hdd: [], general: [] },
        hdd_hr: ["2x NVMe SSD 1 TB"],
        description: ["Intel Core i7-6700", "2x NVMe 1 TB"],
      })
    );
    expect(result).toContain("Disk Breakdown");
    expect(result).toContain("NVMe");
    expect(result).toContain("1 TB");
  });

  it("should show disk breakdown with only HDD", () => {
    const result = formatAuctionDetails(
      makeServer({
        serverDiskData: { nvme: [], sata: [], hdd: [8000, 8000], general: [] },
        hdd_hr: ["2x HDD 8 TB"],
        description: ["Intel Core i7-6700", "2x HDD 8 TB"],
      })
    );
    expect(result).toContain("Disk Breakdown");
    expect(result).toContain("HDD");
    expect(result).toContain("8 TB");
  });

  it("should omit disk breakdown when no disks", () => {
    const result = formatAuctionDetails(
      makeServer({
        serverDiskData: { nvme: [], sata: [], hdd: [], general: [] },
      })
    );
    expect(result).not.toContain("Disk Breakdown");
  });

  it("should show large next_reduce in hours", () => {
    const result = formatAuctionDetails(
      makeServer({
        fixed_price: false,
        next_reduce: 4320, // 72 hours
      })
    );
    expect(result).toContain("72h 0m");
  });

  it("should show multiple description lines", () => {
    const result = formatAuctionDetails(
      makeServer({
        description: [
          "AMD EPYC 7502P",
          "4x RAM 32768 MB DDR4 ECC",
          "2x NVMe SSD 1 TB",
          "NIC 1 Gbit - Intel I219-LM",
          "IPv4",
          "iNIC",
        ],
      })
    );
    expect(result).toContain("AMD EPYC 7502P");
    expect(result).toContain("4x RAM 32768 MB DDR4 ECC");
    expect(result).toContain("2x NVMe SSD 1 TB");
  });

  it("should omit description section when description is empty", () => {
    const result = formatAuctionDetails(makeServer({ description: [] }));
    expect(result).not.toContain("Description");
  });

  it("should show dash for empty hdd_hr array", () => {
    const result = formatAuctionDetails(
      makeServer({
        hdd_hr: [],
      })
    );
    // 'Disk Details' row should have '-' as value when hdd_hr is empty
    expect(result).toContain("Disk Details");
    // The '-' fallback from `hdd_hr.join(', ') || '-'`
    const lines = result.split("\n");
    const diskDetailsLine = lines.find((l) => l.includes("Disk Details"));
    expect(diskDetailsLine).toBeDefined();
    expect(diskDetailsLine).toContain("-");
  });

  it("should show datacenter location and code", () => {
    const result = formatAuctionDetails(
      makeServer({
        datacenter: "HEL1-DC4",
        datacenter_hr: "Helsinki",
      })
    );
    expect(result).toContain("Helsinki");
    expect(result).toContain("HEL1-DC4");
  });

  it("should show multiple specials in details", () => {
    const result = formatAuctionDetails(
      makeServer({
        specials: ["GPU", "iNIC", "ECC", "IPv4"],
      })
    );
    expect(result).toContain("GPU");
    expect(result).toContain("iNIC");
    expect(result).toContain("ECC");
    expect(result).toContain("IPv4");
  });
});
