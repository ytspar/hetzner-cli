import { type AuctionServer, getAuctionServers } from "./auction.ts";

const HOSTED_AUCTION_BASE_URL = "https://auction.hctl.dev";
const AUCTION_FETCH_TIMEOUT_MS = 10_000;
const AUCTION_BROWSER_CACHE_MS = 60_000;
const MAX_ERROR_MESSAGE_LENGTH = 160;
const AUCTION_CURRENCIES = ["EUR", "USD"] as const;
const DISK_TYPE_LABELS = {
  hdd: "HDD",
  nvme: "NVMe",
  sata: "SATA SSD",
} as const;

export type AuctionCurrency = (typeof AUCTION_CURRENCIES)[number];

export interface HostedAuctionMetadata {
  ageSeconds?: number;
  source?: string;
  stale?: boolean;
  updatedAt?: string;
  url: string;
}

export interface AuctionDataset {
  currency: AuctionCurrency;
  errorMessage?: string;
  isLive: boolean;
  metadata: HostedAuctionMetadata;
  requestedCurrency: AuctionCurrency;
  servers: AuctionServer[];
}

interface AuctionCacheEntry {
  cachedAt: number;
  dataset: AuctionDataset;
}

let cachedAuctionData: AuctionCacheEntry | null = null;

export function isAuctionCurrency(value: string): value is AuctionCurrency {
  return AUCTION_CURRENCIES.includes(value as AuctionCurrency);
}

export function normalizeAuctionCurrency(
  value: boolean | string | undefined
): AuctionCurrency | null {
  if (value === undefined || value === false) {
    return "EUR";
  }
  if (value === true) {
    return null;
  }
  const normalized = value.toUpperCase();
  return isAuctionCurrency(normalized) ? normalized : null;
}

export function getAuctionCurrencySymbol(currency: AuctionCurrency): string {
  return currency === "USD" ? "$" : "\u20AC";
}

export async function loadAuctionDataset(
  currency: AuctionCurrency
): Promise<AuctionDataset> {
  const cached = cachedAuctionData;
  const now = Date.now();
  if (
    cached !== null &&
    cached.dataset.requestedCurrency === currency &&
    now - cached.cachedAt < AUCTION_BROWSER_CACHE_MS
  ) {
    return cached.dataset;
  }

  try {
    const dataset = await fetchAuctionDataset(currency);
    cachedAuctionData = { cachedAt: now, dataset };
    return dataset;
  } catch (error) {
    return createFallbackAuctionDataset(currency, error);
  }
}

async function fetchAuctionDataset(
  currency: AuctionCurrency
): Promise<AuctionDataset> {
  const url = `${HOSTED_AUCTION_BASE_URL}/live_data_sb_${currency}.json`;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, AUCTION_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-cache",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`hosted cache returned HTTP ${response.status}`);
    }

    const payload: unknown = await response.json();
    if (!(isRecord(payload) && Array.isArray(payload.server))) {
      throw new Error("hosted cache returned an unexpected JSON shape");
    }

    const servers = payload.server
      .filter(isRecord)
      .map((server) => mapAuctionServer(server));
    if (servers.length === 0) {
      throw new Error("hosted cache returned an empty auction list");
    }

    return {
      currency,
      isLive: true,
      metadata: readAuctionMetadata(response, url),
      requestedCurrency: currency,
      servers,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("hosted cache request timed out");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function readAuctionMetadata(
  response: Response,
  url: string
): HostedAuctionMetadata {
  const ageHeader = response.headers.get("X-Hctl-Auction-Age-Seconds");
  const staleHeader = response.headers.get("X-Hctl-Auction-Stale");
  const ageSeconds = parseOptionalInteger(ageHeader);
  return {
    ageSeconds,
    source: response.headers.get("X-Hctl-Auction-Source") ?? undefined,
    stale: staleHeader === null ? undefined : staleHeader === "true",
    updatedAt: response.headers.get("X-Hctl-Auction-Updated-At") ?? undefined,
    url,
  };
}

function createFallbackAuctionDataset(
  requestedCurrency: AuctionCurrency,
  error: unknown
): AuctionDataset {
  return {
    currency: "EUR",
    errorMessage: normalizeErrorMessage(error),
    isLive: false,
    metadata: {
      url: `${HOSTED_AUCTION_BASE_URL}/live_data_sb_${requestedCurrency}.json`,
    },
    requestedCurrency,
    servers: getAuctionServers(),
  };
}

function normalizeErrorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "hosted cache request failed";
  if (message.length <= MAX_ERROR_MESSAGE_LENGTH) {
    return message;
  }
  return `${message.slice(0, MAX_ERROR_MESSAGE_LENGTH - 1)}...`;
}

function mapAuctionServer(source: Record<string, unknown>): AuctionServer {
  const id = getNumber(source, "id");
  const ramSize = getNumber(source, "ram_size");
  const ram = getStringArray(source, "ram");
  const specials = getStringArray(source, "specials");
  const diskText = getDiskText(source);
  const diskData = getRecord(source, "serverDiskData");
  const category = getString(source, "category");
  const ipPrice = getRecord(source, "ip_price");
  const hasIpv4Special = hasSpecial(specials, "ipv4");

  return {
    bandwidth: getNumber(source, "bandwidth"),
    cpu: getString(source, "cpu") || "Unknown CPU",
    cpu_benchmark: 0,
    cpu_count: getNumber(source, "cpu_count"),
    datacenter:
      getString(source, "datacenter_hr") || getString(source, "datacenter"),
    disk_type: getDiskType(diskData, diskText),
    ecc: getBoolean(source, "is_ecc") || hasSpecial(specials, "ecc"),
    fixed_price: getBoolean(source, "fixed_price"),
    gpu: hasSpecial(specials, "gpu") || category.toLowerCase().includes("gpu"),
    hdd_count: getNumber(source, "hdd_count"),
    hdd_size: getNumber(source, "hdd_size"),
    hdd_text: diskText,
    id,
    inic: hasSpecial(specials, "inic"),
    ipv4: hasIpv4Special || getNumber(ipPrice, "Amount") > 0,
    name: getString(source, "name") || `SB${id}`,
    next_reduce: getNumber(source, "next_reduce"),
    next_reduce_timestamp: getNumber(source, "next_reduce_timestamp"),
    price: getNumber(source, "price"),
    ram: ram.length > 0 ? ram : [`${ramSize} GB`],
    ram_size: ramSize,
    setup_price: getNumber(source, "setup_price"),
    specials,
    traffic: getString(source, "traffic") || "unlimited",
  };
}

function getDiskText(source: Record<string, unknown>): string {
  const hddHr = getStringArray(source, "hdd_hr");
  if (hddHr.length > 0) {
    return hddHr.join(", ");
  }

  const hddArr = getStringArray(source, "hdd_arr");
  if (hddArr.length > 0) {
    return hddArr.join(", ");
  }

  const diskData = getRecord(source, "serverDiskData");
  const diskType = getDiskType(diskData, "");
  return diskType === "Disk" ? "Unknown" : diskType;
}

function getDiskType(
  diskData: Record<string, unknown>,
  diskText: string
): string {
  const labels: string[] = [];
  const normalizedDiskText = diskText.toLowerCase();

  for (const [key, label] of Object.entries(DISK_TYPE_LABELS)) {
    if (
      hasDiskData(diskData, key) ||
      normalizedDiskText.includes(key === "sata" ? "sata" : key)
    ) {
      labels.push(label);
    }
  }

  return labels.length > 0 ? labels.join(" + ") : "Disk";
}

function hasDiskData(
  diskData: Record<string, unknown>,
  diskType: string
): boolean {
  return getNumberArray(diskData, diskType).some((value) => value > 0);
}

function hasSpecial(specials: string[], value: string): boolean {
  const normalized = value.toLowerCase();
  return specials.some((special) => special.toLowerCase().includes(normalized));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRecord(
  source: Record<string, unknown>,
  key: string
): Record<string, unknown> {
  const value = source[key];
  return isRecord(value) ? value : {};
}

function getString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

function getBoolean(source: Record<string, unknown>, key: string): boolean {
  const value = source[key];
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return false;
}

function getNumber(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function getNumberArray(
  source: Record<string, unknown>,
  key: string
): number[] {
  const value = source[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (typeof item === "number" && Number.isFinite(item)) {
        return item;
      }
      if (typeof item === "string") {
        const parsed = Number(item);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    })
    .filter((item): item is number => item !== null);
}

function getStringArray(
  source: Record<string, unknown>,
  key: string
): string[] {
  const value = source[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function parseOptionalInteger(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
