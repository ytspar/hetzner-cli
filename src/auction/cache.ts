import {
  type AuctionFetchOptions,
  type AuctionFetchResult,
  fetchAuctionData,
  getAuctionDataUrl,
} from "./client.js";
import { getAuctionCache, openDatabase, saveAuctionCache } from "./store.js";

export interface AuctionCacheFetchOptions extends AuctionFetchOptions {
  allowLocalFallback?: boolean;
  dbPath?: string;
}

export async function fetchAuctionDataWithCache(
  currency: "EUR" | "USD" = "EUR",
  options: AuctionCacheFetchOptions = {}
): Promise<AuctionFetchResult> {
  try {
    const result = await fetchAuctionData(currency, options);
    saveLatestAuctionCache(currency, options, result);
    return result;
  } catch (error) {
    if (options.allowLocalFallback === true) {
      const cached = readLatestAuctionCache(currency, options);
      if (cached !== null) {
        return cached;
      }
    }

    throw createAuctionFetchUnavailableError(currency, options, error);
  }
}

function saveLatestAuctionCache(
  currency: "EUR" | "USD",
  options: AuctionCacheFetchOptions,
  result: AuctionFetchResult
): void {
  let db: ReturnType<typeof openDatabase> | null = null;
  try {
    db = openDatabase(options.dbPath);
    saveAuctionCache(db, currency, result);
  } catch {
    // The local cache is a convenience fallback. Fetch success should not fail
    // just because the user's cache database cannot be written.
  } finally {
    db?.close();
  }
}

function readLatestAuctionCache(
  currency: "EUR" | "USD",
  options: AuctionCacheFetchOptions
): AuctionFetchResult | null {
  let db: ReturnType<typeof openDatabase> | null = null;
  try {
    db = openDatabase(options.dbPath);
    return getAuctionCache(db, currency);
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

function createAuctionFetchUnavailableError(
  currency: "EUR" | "USD",
  options: AuctionCacheFetchOptions,
  error: unknown
): Error {
  const url = getAuctionDataUrl(currency, options);
  const reason =
    error instanceof Error
      ? ` Reason: ${error.message}.`
      : " The request failed.";
  const cacheHint =
    options.allowLocalFallback === true
      ? " Check your internet connection. No local auction cache is available yet. Run `hctl auction list` once while online to seed it."
      : " Check your internet connection and try again when the network is available.";

  return new Error(
    `Unable to reach auction data at ${url}.${reason}${cacheHint}`
  );
}
