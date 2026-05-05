// ============================================================================
// Hetzner Auction API Client (public, no auth required)
// Endpoint: https://www.hetzner.com/_resources/app/data/app/live_data_sb_EUR.json
// ============================================================================

import type {
  AuctionFilterOptions,
  AuctionResponse,
  AuctionServer,
} from "./types.js";

const HETZNER_AUCTION_BASE_URL =
  "https://www.hetzner.com/_resources/app/data/app";

export const DEFAULT_AUCTION_CACHE_BASE_URL = "https://auction.hctl.dev";

export type AuctionSource = "cache" | "direct";

export interface AuctionFetchOptions {
  cacheBaseUrl?: string;
  source?: AuctionSource;
}

export interface AuctionFetchMetadata {
  ageSeconds?: number;
  fetchedAt: string;
  source: string;
  stale?: boolean;
  updatedAt?: string;
  url: string;
}

export interface AuctionFetchResult {
  data: AuctionResponse;
  metadata: AuctionFetchMetadata;
}

function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function resolveAuctionSource(options: AuctionFetchOptions): AuctionSource {
  if (options.source !== undefined) {
    return options.source;
  }
  const envSource =
    process.env.HCTL_AUCTION_SOURCE ?? process.env.HETZNER_CLI_AUCTION_SOURCE;
  return envSource === "direct" ? "direct" : "cache";
}

function resolveAuctionBaseUrl(options: AuctionFetchOptions): string {
  if (resolveAuctionSource(options) === "direct") {
    return HETZNER_AUCTION_BASE_URL;
  }
  return (
    options.cacheBaseUrl ??
    process.env.HCTL_AUCTION_CACHE_URL ??
    process.env.HETZNER_CLI_AUCTION_CACHE_URL ??
    DEFAULT_AUCTION_CACHE_BASE_URL
  );
}

export function getAuctionDataUrl(
  currency: "EUR" | "USD" = "EUR",
  options: AuctionFetchOptions = {}
): string {
  return `${trimTrailingSlash(resolveAuctionBaseUrl(options))}/live_data_sb_${currency}.json`;
}

function parseOptionalNumber(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalBoolean(value: string | null): boolean | undefined {
  if (value === null) {
    return undefined;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

function getResponseHeader(response: Response, name: string): string | null {
  return response.headers?.get?.(name) ?? null;
}

export async function fetchAuctionData(
  currency: "EUR" | "USD" = "EUR",
  options: AuctionFetchOptions = {}
): Promise<AuctionFetchResult> {
  const url = getAuctionDataUrl(currency, options);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch auction data: HTTP ${response.status}`);
  }
  const data = (await response.json()) as AuctionResponse;
  return {
    data,
    metadata: {
      ageSeconds: parseOptionalNumber(
        getResponseHeader(response, "X-Hctl-Auction-Age-Seconds")
      ),
      fetchedAt: new Date().toISOString(),
      source:
        getResponseHeader(response, "X-Hctl-Auction-Source") ??
        resolveAuctionSource(options),
      stale: parseOptionalBoolean(
        getResponseHeader(response, "X-Hctl-Auction-Stale")
      ),
      updatedAt:
        getResponseHeader(response, "X-Hctl-Auction-Updated-At") ?? undefined,
      url,
    },
  };
}

export async function fetchAuctionServers(
  currency: "EUR" | "USD" = "EUR",
  options: AuctionFetchOptions = {}
): Promise<AuctionResponse> {
  const { data } = await fetchAuctionData(currency, options);
  return data;
}

function getTotalDisk(s: AuctionServer): number {
  return [
    ...s.serverDiskData.nvme,
    ...s.serverDiskData.sata,
    ...s.serverDiskData.hdd,
  ].reduce((sum, d) => sum + d, 0);
}

function matchesPriceFilters(
  s: AuctionServer,
  filters: AuctionFilterOptions
): boolean {
  if (filters.minPrice !== undefined && s.price < filters.minPrice) {
    return false;
  }
  if (filters.maxPrice !== undefined && s.price > filters.maxPrice) {
    return false;
  }
  if (
    filters.maxHourlyPrice !== undefined &&
    s.hourly_price > filters.maxHourlyPrice
  ) {
    return false;
  }
  if (
    filters.maxSetupPrice !== undefined &&
    s.setup_price > filters.maxSetupPrice
  ) {
    return false;
  }
  if (
    filters.fixedPrice !== undefined &&
    s.fixed_price !== filters.fixedPrice
  ) {
    return false;
  }
  return true;
}

function matchesHardwareFilters(
  s: AuctionServer,
  filters: AuctionFilterOptions
): boolean {
  if (filters.minRam !== undefined && s.ram_size < filters.minRam) {
    return false;
  }
  if (filters.maxRam !== undefined && s.ram_size > filters.maxRam) {
    return false;
  }
  if (filters.cpu && !s.cpu.toLowerCase().includes(filters.cpu.toLowerCase())) {
    return false;
  }
  if (filters.minCpuCount !== undefined && s.cpu_count < filters.minCpuCount) {
    return false;
  }
  if (filters.maxCpuCount !== undefined && s.cpu_count > filters.maxCpuCount) {
    return false;
  }
  if (
    filters.minBandwidth !== undefined &&
    s.bandwidth < filters.minBandwidth
  ) {
    return false;
  }
  return true;
}

function matchesDiskFilters(
  s: AuctionServer,
  filters: AuctionFilterOptions
): boolean {
  if (filters.minDiskSize !== undefined || filters.maxDiskSize !== undefined) {
    const total = getTotalDisk(s);
    if (filters.minDiskSize !== undefined && total < filters.minDiskSize) {
      return false;
    }
    if (filters.maxDiskSize !== undefined && total > filters.maxDiskSize) {
      return false;
    }
  }
  if (
    filters.minDiskCount !== undefined &&
    s.hdd_count < filters.minDiskCount
  ) {
    return false;
  }
  if (
    filters.maxDiskCount !== undefined &&
    s.hdd_count > filters.maxDiskCount
  ) {
    return false;
  }
  if (filters.diskType && s.serverDiskData[filters.diskType].length === 0) {
    return false;
  }
  return true;
}

function matchesFeatureFilters(
  s: AuctionServer,
  filters: AuctionFilterOptions
): boolean {
  if (filters.ecc !== undefined && s.is_ecc !== filters.ecc) {
    return false;
  }
  if (filters.gpu !== undefined) {
    const hasGpu = s.specials.includes("GPU");
    if (filters.gpu !== hasGpu) {
      return false;
    }
  }
  if (filters.inic !== undefined) {
    const hasInic = s.specials.includes("iNIC");
    if (filters.inic !== hasInic) {
      return false;
    }
  }
  if (filters.highio !== undefined && s.is_highio !== filters.highio) {
    return false;
  }
  if (filters.specials) {
    const search = filters.specials.toLowerCase();
    if (!s.specials.some((sp) => sp.toLowerCase().includes(search))) {
      return false;
    }
  }
  return true;
}

function matchesTextAndLocationFilters(
  s: AuctionServer,
  filters: AuctionFilterOptions
): boolean {
  if (
    filters.datacenter &&
    !s.datacenter.toLowerCase().includes(filters.datacenter.toLowerCase())
  ) {
    return false;
  }
  if (filters.text) {
    const searchText = filters.text.toLowerCase();
    const haystack = s.description.join(" ").toLowerCase();
    if (!haystack.includes(searchText)) {
      return false;
    }
  }
  return true;
}

export function filterAuctionServers(
  servers: AuctionServer[],
  filters: AuctionFilterOptions
): AuctionServer[] {
  return servers.filter((s) => {
    if (!matchesPriceFilters(s, filters)) {
      return false;
    }
    if (!matchesHardwareFilters(s, filters)) {
      return false;
    }
    if (!matchesDiskFilters(s, filters)) {
      return false;
    }
    if (!matchesFeatureFilters(s, filters)) {
      return false;
    }
    return matchesTextAndLocationFilters(s, filters);
  });
}

export function sortAuctionServers(
  servers: AuctionServer[],
  field: string,
  desc: boolean
): AuctionServer[] {
  const sorted = [...servers].sort((a, b) => {
    switch (field) {
      case "price":
        return a.price - b.price;
      case "hourly":
        return a.hourly_price - b.hourly_price;
      case "setup":
        return a.setup_price - b.setup_price;
      case "ram":
        return a.ram_size - b.ram_size;
      case "disk":
        return getTotalDisk(a) - getTotalDisk(b);
      case "disk_count":
        return a.hdd_count - b.hdd_count;
      case "cpu":
        return a.cpu.localeCompare(b.cpu);
      case "cpu_count":
        return a.cpu_count - b.cpu_count;
      case "datacenter":
        return a.datacenter.localeCompare(b.datacenter);
      case "bandwidth":
        return a.bandwidth - b.bandwidth;
      case "next_reduce":
        return a.next_reduce - b.next_reduce;
      default:
        return a.price - b.price;
    }
  });
  return desc ? sorted.reverse() : sorted;
}
