const CURRENCIES = ["EUR", "USD"];
const DEFAULT_HETZNER_AUCTION_BASE_URL =
  "https://www.hetzner.com/_resources/app/data/app";
const REFRESH_AFTER_MS = 16 * 60 * 1000;
const DEFAULT_FETCH_TIMEOUT_MS = 20_000;
const MAX_FAILURE_MESSAGE_LENGTH = 240;
const AUCTION_FILE_PATH_PATTERN = /^\/live_data_sb_(EUR|USD)\.json$/;
const WHITESPACE_PATTERN = /\s+/g;
const CRON_TRIGGER = "*/15 * * * *";
const AUCTION_CACHE_CONTROL =
  "public, max-age=60, s-maxage=900, stale-while-revalidate=3600";
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers":
    "Cache-Control, X-Hctl-Auction-Age-Seconds, X-Hctl-Auction-Last-Failure-At, X-Hctl-Auction-Source, X-Hctl-Auction-Stale, X-Hctl-Auction-Updated-At",
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  "Content-Type": JSON_CONTENT_TYPE,
};

function kvDataKey(currency) {
  return `auction:${currency}:data`;
}

function kvMetadataKey(currency) {
  return `auction:${currency}:metadata`;
}

function failureObjectKey(currency) {
  return `failures/${currency}.json`;
}

function kvFailureKey(currency) {
  return `auction:${currency}:failure`;
}

function latestObjectKey(currency) {
  return `latest/live_data_sb_${currency}.json`;
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function historyObjectKey(currency, updatedAt) {
  const parsedDate = new Date(updatedAt);
  const date = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const year = date.getUTCFullYear();
  const month = padDatePart(date.getUTCMonth() + 1);
  const day = padDatePart(date.getUTCDate());
  const hour = padDatePart(date.getUTCHours());
  const minute = padDatePart(date.getUTCMinutes());
  return `history/${year}/${month}/${day}/${hour}${minute}/live_data_sb_${currency}.json`;
}

function trimTrailingSlash(url) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAuctionResponse(value) {
  return isRecord(value) && Array.isArray(value.server);
}

function getAuctionBucket(env) {
  return env.AUCTION_BUCKET ?? null;
}

function getHetznerAuctionUrl(currency, env) {
  const baseUrl =
    env.HETZNER_AUCTION_BASE_URL ?? DEFAULT_HETZNER_AUCTION_BASE_URL;
  return `${trimTrailingSlash(baseUrl)}/live_data_sb_${currency}.json`;
}

function getFetchTimeoutMs(env) {
  const configuredTimeout = Number(env.HETZNER_AUCTION_FETCH_TIMEOUT_MS);
  if (Number.isFinite(configuredTimeout) && configuredTimeout > 0) {
    return Math.floor(configuredTimeout);
  }
  return DEFAULT_FETCH_TIMEOUT_MS;
}

function getRoutePath(pathname) {
  if (pathname === "/auction") {
    return "/";
  }
  if (pathname.startsWith("/auction/")) {
    return pathname.slice("/auction".length);
  }
  return pathname;
}

function getRequestedCurrency(request) {
  const url = new URL(request.url);
  const path = getRoutePath(url.pathname);
  const fileMatch = AUCTION_FILE_PATH_PATTERN.exec(path);
  if (fileMatch?.[1]) {
    return fileMatch[1];
  }

  if (path === "/latest" || path === "/latest.json") {
    const currency = url.searchParams.get("currency")?.toUpperCase() ?? "EUR";
    return CURRENCIES.includes(currency) ? currency : null;
  }

  return null;
}

function createJsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    headers: { ...JSON_HEADERS, ...headers },
    status,
  });
}

function getMetadataAgeSeconds(metadata) {
  const updatedAt = Date.parse(metadata.updatedAt);
  if (Number.isNaN(updatedAt)) {
    return null;
  }
  return Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
}

function shouldRefresh(metadata) {
  const updatedAt = Date.parse(metadata.updatedAt);
  if (Number.isNaN(updatedAt)) {
    return true;
  }
  return Date.now() - updatedAt > REFRESH_AFTER_MS;
}

function createAuctionHeaders(metadata, source, failure) {
  const ageSeconds = getMetadataAgeSeconds(metadata);
  const headers = {
    ...JSON_HEADERS,
    "Cache-Control": AUCTION_CACHE_CONTROL,
    "X-Hctl-Auction-Age-Seconds":
      ageSeconds === null ? "unknown" : String(ageSeconds),
    "X-Hctl-Auction-Stale": shouldRefresh(metadata) ? "true" : "false",
    "X-Hctl-Auction-Source": source,
    "X-Hctl-Auction-Updated-At": metadata.updatedAt,
  };
  if (failure !== null) {
    headers["X-Hctl-Auction-Last-Failure-At"] = failure.failedAt;
  }
  return headers;
}

function createAuctionResponse(request, snapshot, source, failure = null) {
  return new Response(request.method === "HEAD" ? null : snapshot.body, {
    headers: createAuctionHeaders(snapshot.metadata, source, failure),
  });
}

function toOptionalNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function getString(value) {
  return typeof value === "string" ? value : undefined;
}

function createEmptyMetadata(currency) {
  return {
    currency,
    latestKey: latestObjectKey(currency),
    serverCount: 0,
    sourceUrl: getHetznerAuctionUrl(currency, {}),
    storage: "unknown",
    updatedAt: new Date(0).toISOString(),
  };
}

function normalizeMetadata(value, currency) {
  if (!isRecord(value) || typeof value.updatedAt !== "string") {
    return createEmptyMetadata(currency);
  }

  const metadata = {
    currency: getString(value.currency) ?? currency,
    latestKey: getString(value.latestKey) ?? latestObjectKey(currency),
    serverCount: toOptionalNumber(value.serverCount) ?? 0,
    serverCountReported:
      toOptionalNumber(value.serverCountReported) ??
      toOptionalNumber(value.serverCount) ??
      0,
    sourceUrl: getString(value.sourceUrl) ?? getHetznerAuctionUrl(currency, {}),
    storage: getString(value.storage) ?? "unknown",
    updatedAt: value.updatedAt,
  };
  const etag = getString(value.etag);
  const fetchedAt = getString(value.fetchedAt);
  const historyKey = getString(value.historyKey);
  if (etag !== undefined) {
    metadata.etag = etag;
  }
  if (fetchedAt !== undefined) {
    metadata.fetchedAt = fetchedAt;
  }
  if (historyKey !== undefined) {
    metadata.historyKey = historyKey;
  }
  return metadata;
}

function normalizeFailure(value, currency) {
  if (!isRecord(value) || typeof value.failedAt !== "string") {
    return null;
  }
  return {
    currency,
    failedAt: value.failedAt,
    message:
      typeof value.message === "string"
        ? value.message
        : "Unknown refresh failure",
    sourceUrl:
      typeof value.sourceUrl === "string"
        ? value.sourceUrl
        : getHetznerAuctionUrl(currency, {}),
  };
}

function toCustomMetadata(metadata) {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  );
}

async function readObjectMetadata(bucket, key, currency) {
  const object =
    typeof bucket.head === "function"
      ? await bucket.head(key)
      : await bucket.get(key);
  if (object === null) {
    return null;
  }
  return normalizeMetadata(object.customMetadata ?? {}, currency);
}

function objectToText(object) {
  if (typeof object.text === "function") {
    return object.text();
  }
  if (typeof object.body === "string") {
    return object.body;
  }
  return new Response(object.body).text();
}

async function readCachedAuctionFromR2(currency, env) {
  const bucket = getAuctionBucket(env);
  if (bucket === null) {
    return null;
  }

  const object = await bucket.get(latestObjectKey(currency));
  if (object === null) {
    return null;
  }
  return {
    body: object.body,
    metadata: normalizeMetadata(object.customMetadata ?? {}, currency),
    source: "cloudflare-r2",
  };
}

async function readCachedAuctionFromKv(currency, env) {
  if (env.AUCTION_CACHE === undefined) {
    return null;
  }

  const cached = await env.AUCTION_CACHE.getWithMetadata(kvDataKey(currency));
  if (cached.value === null) {
    return null;
  }
  return {
    body: cached.value,
    metadata: {
      ...normalizeMetadata(cached.metadata, currency),
      storage: "cloudflare-kv",
    },
    source: "cloudflare-kv",
  };
}

async function readCachedAuction(currency, env) {
  return (
    (await readCachedAuctionFromR2(currency, env)) ??
    (await readCachedAuctionFromKv(currency, env))
  );
}

async function readStoredMetadataFromKv(currency, env) {
  if (env.AUCTION_CACHE === undefined) {
    return null;
  }

  const rawMetadata = await env.AUCTION_CACHE.get(kvMetadataKey(currency));
  if (rawMetadata === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawMetadata);
    return isRecord(parsed)
      ? { ...normalizeMetadata(parsed, currency), storage: "cloudflare-kv" }
      : null;
  } catch {
    return null;
  }
}

async function readStoredMetadata(currency, env) {
  const bucket = getAuctionBucket(env);
  if (bucket !== null) {
    const r2Metadata = await readObjectMetadata(
      bucket,
      latestObjectKey(currency),
      currency
    );
    if (r2Metadata !== null) {
      return r2Metadata;
    }
  }
  return readStoredMetadataFromKv(currency, env);
}

async function readRefreshFailureFromKv(currency, env) {
  if (env.AUCTION_CACHE === undefined) {
    return null;
  }

  const rawFailure = await env.AUCTION_CACHE.get(kvFailureKey(currency));
  if (rawFailure === null) {
    return null;
  }

  try {
    return normalizeFailure(JSON.parse(rawFailure), currency);
  } catch {
    return null;
  }
}

async function readRefreshFailure(currency, env) {
  const bucket = getAuctionBucket(env);
  if (bucket !== null) {
    const object = await bucket.get(failureObjectKey(currency));
    if (object !== null) {
      try {
        return normalizeFailure(
          JSON.parse(await objectToText(object)),
          currency
        );
      } catch {
        return null;
      }
    }
  }

  return readRefreshFailureFromKv(currency, env);
}

function errorToMessage(error) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
      .replace(WHITESPACE_PATTERN, " ")
      .slice(0, MAX_FAILURE_MESSAGE_LENGTH);
  }
  return "Unknown refresh failure";
}

async function recordRefreshFailure(currency, env, error) {
  const failure = {
    currency,
    failedAt: new Date().toISOString(),
    message: errorToMessage(error),
    sourceUrl: getHetznerAuctionUrl(currency, env),
  };
  const bucket = getAuctionBucket(env);
  if (bucket !== null) {
    await bucket.put(failureObjectKey(currency), JSON.stringify(failure), {
      customMetadata: toCustomMetadata(failure),
      httpMetadata: { contentType: JSON_CONTENT_TYPE },
    });
    return failure;
  }

  await env.AUCTION_CACHE.put(kvFailureKey(currency), JSON.stringify(failure));
  return failure;
}

async function clearRefreshFailure(currency, env) {
  const bucket = getAuctionBucket(env);
  if (bucket !== null) {
    await bucket.delete(failureObjectKey(currency));
    return;
  }
  if (typeof env.AUCTION_CACHE?.delete === "function") {
    await env.AUCTION_CACHE.delete(kvFailureKey(currency));
  }
}

async function fetchAuctionFromHetzner(currency, env) {
  const sourceUrl = getHetznerAuctionUrl(currency, env);
  const timeoutMs = getFetchTimeoutMs(env);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(sourceUrl, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        `Hetzner auction endpoint timed out after ${timeoutMs}ms`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(
      `Hetzner auction endpoint returned HTTP ${response.status}`
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Hetzner auction endpoint returned invalid JSON");
  }
  if (!isAuctionResponse(data)) {
    throw new Error("Hetzner auction endpoint returned invalid JSON");
  }

  const metadata = {
    currency,
    fetchedAt: new Date().toISOString(),
    serverCount: data.server.length,
    serverCountReported:
      typeof data.serverCount === "number"
        ? data.serverCount
        : data.server.length,
    sourceUrl,
    updatedAt: new Date().toISOString(),
  };
  const etag = response.headers.get("etag");
  if (etag !== null) {
    metadata.etag = etag;
  }

  return {
    body: JSON.stringify(data),
    metadata,
  };
}

async function writeAuctionSnapshotToR2(currency, env, snapshot) {
  const bucket = getAuctionBucket(env);
  if (bucket === null) {
    return null;
  }

  const latestKey = latestObjectKey(currency);
  const historyKey = historyObjectKey(currency, snapshot.metadata.updatedAt);
  const metadata = {
    ...snapshot.metadata,
    historyKey,
    latestKey,
    storage: "cloudflare-r2",
  };
  const latestOptions = {
    customMetadata: toCustomMetadata(metadata),
    httpMetadata: {
      cacheControl: AUCTION_CACHE_CONTROL,
      contentType: JSON_CONTENT_TYPE,
    },
  };
  const historyOptions = {
    customMetadata: toCustomMetadata({
      ...metadata,
      archivedAt: new Date().toISOString(),
      objectRole: "history",
    }),
    httpMetadata: {
      cacheControl: "public, max-age=31536000, immutable",
      contentType: JSON_CONTENT_TYPE,
    },
  };

  await Promise.all([
    bucket.put(latestKey, snapshot.body, latestOptions),
    bucket.put(historyKey, snapshot.body, historyOptions),
  ]);

  return {
    body: snapshot.body,
    metadata,
  };
}

async function writeAuctionSnapshotToKv(currency, env, snapshot) {
  const metadata = {
    ...snapshot.metadata,
    latestKey: kvDataKey(currency),
    storage: "cloudflare-kv",
  };
  await env.AUCTION_CACHE.put(kvDataKey(currency), snapshot.body, {
    metadata,
  });
  await env.AUCTION_CACHE.put(
    kvMetadataKey(currency),
    JSON.stringify(metadata)
  );
  return {
    body: snapshot.body,
    metadata,
  };
}

async function refreshAuction(currency, env) {
  const snapshot = await fetchAuctionFromHetzner(currency, env);
  return (
    (await writeAuctionSnapshotToR2(currency, env, snapshot)) ??
    (await writeAuctionSnapshotToKv(currency, env, snapshot))
  );
}

async function refreshAuctionWithFailureRecord(currency, env) {
  try {
    const snapshot = await refreshAuction(currency, env);
    await clearRefreshFailure(currency, env);
    return snapshot;
  } catch (error) {
    await recordRefreshFailure(currency, env, error);
    throw error;
  }
}

async function refreshAllAuctions(env) {
  const results = await Promise.allSettled(
    CURRENCIES.map((currency) => refreshAuctionWithFailureRecord(currency, env))
  );
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    throw new Error(`Failed to refresh ${failures.length} auction cache(s)`);
  }
}

async function serveAuction(request, env, ctx, currency) {
  const cached = await readCachedAuction(currency, env);
  const failure = await readRefreshFailure(currency, env);
  if (cached !== null) {
    if (shouldRefresh(cached.metadata)) {
      ctx.waitUntil(
        refreshAuctionWithFailureRecord(currency, env).catch(() => undefined)
      );
    }
    return createAuctionResponse(request, cached, cached.source, failure);
  }

  try {
    const refreshed = await refreshAuctionWithFailureRecord(currency, env);
    return createAuctionResponse(request, refreshed, "hetzner-refresh");
  } catch (error) {
    const recordedFailure =
      (await readRefreshFailure(currency, env)) ??
      normalizeFailure(
        {
          failedAt: new Date().toISOString(),
          message: errorToMessage(error),
          sourceUrl: getHetznerAuctionUrl(currency, env),
        },
        currency
      );
    return createJsonResponse(
      {
        currency,
        error: "Auction cache unavailable",
        failure: recordedFailure,
        message:
          "Hetzner refresh failed and no cached auction data is available.",
      },
      502,
      {
        "Cache-Control": "no-store",
        "Retry-After": "300",
      }
    );
  }
}

async function serveMetadata(env) {
  const metadataEntries = await Promise.all(
    CURRENCIES.map(async (currency) => [
      currency,
      await readStoredMetadata(currency, env),
    ])
  );
  const failureEntries = await Promise.all(
    CURRENCIES.map(async (currency) => [
      currency,
      await readRefreshFailure(currency, env),
    ])
  );
  return createJsonResponse({
    currencies: Object.fromEntries(metadataEntries),
    endpoints: CURRENCIES.map((currency) => `/live_data_sb_${currency}.json`),
    failures: Object.fromEntries(failureEntries),
    historyPrefix: "history/",
    storage: getAuctionBucket(env) === null ? "cloudflare-kv" : "cloudflare-r2",
  });
}

async function serveHealth(env) {
  const metadataEntries = await Promise.all(
    CURRENCIES.map(async (currency) => [
      currency,
      await readStoredMetadata(currency, env),
    ])
  );
  const failureEntries = await Promise.all(
    CURRENCIES.map(async (currency) => [
      currency,
      await readRefreshFailure(currency, env),
    ])
  );
  const missingCurrencies = metadataEntries
    .filter(([, metadata]) => metadata === null)
    .map(([currency]) => currency);
  const failedCurrencies = failureEntries
    .filter(([, failure]) => failure !== null)
    .map(([currency]) => currency);
  const staleCurrencies = metadataEntries
    .filter(([, metadata]) => metadata === null || shouldRefresh(metadata))
    .map(([currency]) => currency);
  const ok = missingCurrencies.length === 0 && failedCurrencies.length === 0;

  return createJsonResponse(
    {
      failures: Object.fromEntries(failureEntries),
      failedCurrencies,
      missingCurrencies,
      ok,
      staleCurrencies,
      storage:
        getAuctionBucket(env) === null ? "cloudflare-kv" : "cloudflare-r2",
    },
    ok ? 200 : 503,
    {
      "Cache-Control": "no-store",
    }
  );
}

function serveIndex(request, env) {
  const url = new URL(request.url);
  const basePath = url.pathname.startsWith("/auction") ? "/auction" : "";
  const origin = `${url.origin}${basePath}`;
  return createJsonResponse({
    endpoints: {
      EUR: `${origin}/live_data_sb_EUR.json`,
      USD: `${origin}/live_data_sb_USD.json`,
      health: `${origin}/health.json`,
      latest: `${origin}/latest.json?currency=EUR`,
      metadata: `${origin}/metadata.json`,
    },
    refresh: `Cloudflare Cron Trigger: ${CRON_TRIGGER}`,
    source: "https://www.hetzner.com/sb/",
    storage: getAuctionBucket(env) === null ? "cloudflare-kv" : "cloudflare-r2",
  });
}

export default {
  fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS, status: 204 });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return createJsonResponse({ error: "Method not allowed" }, 405, {
        Allow: "GET, HEAD, OPTIONS",
      });
    }

    const url = new URL(request.url);
    const path = getRoutePath(url.pathname);
    const currency = getRequestedCurrency(request);
    if (currency !== null) {
      return serveAuction(request, env, ctx, currency);
    }
    if (path === "/metadata.json") {
      return serveMetadata(env);
    }
    if (path === "/health.json") {
      return serveHealth(env);
    }
    if (path === "/") {
      return serveIndex(request, env);
    }

    return createJsonResponse({ error: "Not found" }, 404);
  },

  scheduled(_controller, env, ctx) {
    ctx.waitUntil(refreshAllAuctions(env));
  },
};
