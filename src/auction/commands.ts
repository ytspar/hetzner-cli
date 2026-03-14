import { type Command, Option } from "commander";
import { error, formatJson } from "../shared/formatter.js";
import {
  fetchAuctionServers,
  filterAuctionServers,
  sortAuctionServers,
} from "./client.js";
import { formatAuctionDetails, formatAuctionList } from "./formatter.js";
import type { AuctionFilterOptions } from "./types.js";

interface AuctionListOptions {
  auctionOnly?: boolean;
  cpu?: string;
  currency?: "EUR" | "USD";
  datacenter?: string;
  desc?: boolean;
  diskType?: "nvme" | "sata" | "hdd";
  ecc?: boolean;
  fixedPrice?: boolean;
  gpu?: boolean;
  highio?: boolean;
  inic?: boolean;
  json?: boolean;
  limit?: string;
  maxCpuCount?: string;
  maxDiskCount?: string;
  maxDiskSize?: string;
  maxHourlyPrice?: string;
  maxPrice?: string;
  maxRam?: string;
  maxSetupPrice?: string;
  minBandwidth?: string;
  minCpuCount?: string;
  minDiskCount?: string;
  minDiskSize?: string;
  minPrice?: string;
  minRam?: string;
  noSetupFee?: boolean;
  search?: string;
  sort?: string;
  specials?: string;
}

interface AuctionShowOptions {
  currency?: "EUR" | "USD";
  json?: boolean;
}

function resolveFixedPrice(
  fixedPrice: boolean | undefined,
  auctionOnly: boolean | undefined
): boolean | undefined {
  if (fixedPrice) {
    return true;
  }
  if (auctionOnly) {
    return false;
  }
  return undefined;
}

function parseNum(val: string | undefined): number | undefined {
  if (val === undefined) {
    return undefined;
  }
  const n = Number(val);
  return Number.isNaN(n) ? undefined : n;
}

function buildFilters(options: AuctionListOptions): AuctionFilterOptions {
  return {
    minPrice: parseNum(options.minPrice),
    maxPrice: parseNum(options.maxPrice),
    maxHourlyPrice: parseNum(options.maxHourlyPrice),
    minRam: parseNum(options.minRam),
    maxRam: parseNum(options.maxRam),
    cpu: options.cpu,
    datacenter: options.datacenter,
    minDiskSize: parseNum(options.minDiskSize),
    maxDiskSize: parseNum(options.maxDiskSize),
    minDiskCount: parseNum(options.minDiskCount),
    maxDiskCount: parseNum(options.maxDiskCount),
    diskType: options.diskType,
    minBandwidth: parseNum(options.minBandwidth),
    ecc: options.ecc ? true : undefined,
    gpu: options.gpu ? true : undefined,
    inic: options.inic ? true : undefined,
    highio: options.highio ? true : undefined,
    specials: options.specials,
    fixedPrice: resolveFixedPrice(options.fixedPrice, options.auctionOnly),
    maxSetupPrice: options.noSetupFee ? 0 : parseNum(options.maxSetupPrice),
    minCpuCount: parseNum(options.minCpuCount),
    maxCpuCount: parseNum(options.maxCpuCount),
    text: options.search,
  };
}

function auctionAction(fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    try {
      await fn();
    } catch (err) {
      console.error(
        error(
          err instanceof Error ? err.message : "Failed to fetch auction data"
        )
      );
      process.exit(1);
    }
  };
}

export function registerAuctionCommands(parent: Command): void {
  const auction = parent
    .command("auction")
    .description(
      "Server auction monitoring (public, no auth required).\n" +
        "Fetches ~1000+ servers from Hetzner's public auction endpoint and filters/sorts client-side.\n" +
        "Typical ranges: 30-450 EUR/mo, 32-1024 GB RAM, NVMe/SATA/HDD, datacenters in FSN/HEL/NBG."
    );

  auction
    .command("list")
    .alias("ls")
    .description(
      "List and filter auction servers.\n" +
        "All filters are optional and combinable. String filters (cpu, datacenter, specials, search) are case-insensitive substrings.\n" +
        "Examples:\n" +
        "  hetzner auction list --cpu epyc --ecc --disk-type nvme --datacenter HEL --sort price\n" +
        "  hetzner auction list --gpu --max-price 150 --json\n" +
        "  hetzner auction list --auction-only --sort next_reduce --limit 20"
    )
    .option("--min-price <n>", "Minimum monthly price")
    .option("--max-price <n>", "Maximum monthly price")
    .option("--max-hourly-price <n>", "Maximum hourly price")
    .option("--min-ram <gb>", "Minimum RAM in GB")
    .option("--max-ram <gb>", "Maximum RAM in GB")
    .option("--cpu <text>", 'CPU model substring (e.g. "Ryzen", "i7-6700")')
    .option("--min-cpu-count <n>", "Minimum CPU/socket count")
    .option("--max-cpu-count <n>", "Maximum CPU/socket count")
    .option(
      "--datacenter <text>",
      'Datacenter substring (e.g. "FSN", "HEL1-DC2")'
    )
    .option("--min-disk-size <gb>", "Minimum total disk capacity in GB")
    .option("--max-disk-size <gb>", "Maximum total disk capacity in GB")
    .option("--min-disk-count <n>", "Minimum number of drives")
    .option("--max-disk-count <n>", "Maximum number of drives")
    .addOption(
      new Option("--disk-type <type>", "Filter by disk type present").choices([
        "nvme",
        "sata",
        "hdd",
      ])
    )
    .option("--min-bandwidth <mbit>", "Minimum bandwidth in Mbit/s")
    .option("--ecc", "Only ECC RAM servers")
    .option("--gpu", "Only GPU servers")
    .option("--inic", "Only servers with Intel NIC")
    .option("--highio", "Only high I/O servers")
    .option("--specials <text>", "Filter by special feature (substring match)")
    .option("--fixed-price", "Only fixed-price servers")
    .option("--auction-only", "Only auction (non-fixed) servers")
    .option("--no-setup-fee", "Only servers with no setup fee")
    .option("--max-setup-price <n>", "Maximum setup price")
    .option("--search <text>", "Free-text search across description")
    .addOption(
      new Option("--currency <currency>", "Price currency")
        .choices(["EUR", "USD"])
        .default("EUR")
    )
    .addOption(
      new Option("--sort <field>", "Sort by field")
        .choices([
          "price",
          "hourly",
          "setup",
          "ram",
          "disk",
          "disk_count",
          "cpu",
          "cpu_count",
          "datacenter",
          "bandwidth",
          "next_reduce",
        ])
        .default("price")
    )
    .option("--desc", "Sort in descending order")
    .option("--limit <n>", "Limit output rows")
    .action((options: AuctionListOptions) =>
      auctionAction(async () => {
        const { server: servers } = await fetchAuctionServers(
          options.currency as "EUR" | "USD"
        );

        const filters = buildFilters(options);
        let filtered = filterAuctionServers(servers, filters);
        filtered = sortAuctionServers(
          filtered,
          options.sort || "price",
          !!options.desc
        );

        const limit = parseNum(options.limit);
        if (limit !== undefined && limit > 0) {
          filtered = filtered.slice(0, limit);
        }

        if (options.json) {
          console.log(formatJson(filtered));
        } else {
          console.log(formatAuctionList(filtered));
        }
      })()
    );

  auction
    .command("show <id>")
    .description(
      "Show detailed info for an auction server.\n" +
        "Displays CPU, RAM, disk breakdown by type, datacenter, pricing (monthly + hourly),\n" +
        "specials (GPU, iNIC, ECC), IP pricing, and full description.\n" +
        "Example: hetzner auction show 2919866"
    )
    .addOption(
      new Option("--currency <currency>", "Price currency")
        .choices(["EUR", "USD"])
        .default("EUR")
    )
    .action((id: string, options: AuctionShowOptions) =>
      auctionAction(async () => {
        const serverId = Number.parseInt(id, 10);
        if (Number.isNaN(serverId)) {
          console.error(error("Invalid server ID"));
          process.exit(1);
        }

        const { server: servers } = await fetchAuctionServers(
          options.currency as "EUR" | "USD"
        );
        const server = servers.find((s) => s.id === serverId);

        if (!server) {
          console.error(error(`Auction server ${id} not found`));
          process.exit(1);
        }

        if (options.json) {
          console.log(formatJson(server));
        } else {
          console.log(formatAuctionDetails(server));
        }
      })()
    );
}
