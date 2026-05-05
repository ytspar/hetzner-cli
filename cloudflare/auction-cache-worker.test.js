import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "./auction-cache-worker.js";

const OLD_METADATA = {
  currency: "EUR",
  fetchedAt: "2026-05-05T00:00:00.000Z",
  historyKey: "history/2026/05/05/0000/live_data_sb_EUR.json",
  latestKey: "latest/live_data_sb_EUR.json",
  serverCount: 1,
  serverCountReported: 1,
  sourceUrl:
    "https://www.hetzner.com/_resources/app/data/app/live_data_sb_EUR.json",
  storage: "cloudflare-r2",
  updatedAt: "2026-05-05T00:00:00.000Z",
};

function createKvNamespace() {
  const entries = new Map();

  return {
    delete(key) {
      entries.delete(key);
      return Promise.resolve();
    },
    entries,
    get(key) {
      return Promise.resolve(entries.get(key)?.value ?? null);
    },
    getWithMetadata(key) {
      const entry = entries.get(key);
      return Promise.resolve({
        metadata: entry?.metadata ?? null,
        value: entry?.value ?? null,
      });
    },
    put(key, value, options = {}) {
      entries.set(key, {
        metadata: options.metadata ?? null,
        value,
      });
      return Promise.resolve();
    },
  };
}

function createR2Object(entry) {
  return {
    body: entry.body,
    customMetadata: entry.customMetadata ?? {},
    httpMetadata: entry.httpMetadata ?? {},
    text() {
      return Promise.resolve(entry.body);
    },
  };
}

function createR2Bucket() {
  const objects = new Map();

  return {
    delete(key) {
      objects.delete(key);
      return Promise.resolve();
    },
    get(key) {
      const entry = objects.get(key);
      return Promise.resolve(
        entry === undefined ? null : createR2Object(entry)
      );
    },
    head(key) {
      const entry = objects.get(key);
      return Promise.resolve(
        entry === undefined ? null : createR2Object(entry)
      );
    },
    objects,
    put(key, body, options = {}) {
      objects.set(key, {
        body,
        customMetadata: options.customMetadata ?? {},
        httpMetadata: options.httpMetadata ?? {},
      });
      return Promise.resolve();
    },
  };
}

function createEnv({
  bucket = createR2Bucket(),
  kv = createKvNamespace(),
} = {}) {
  return {
    AUCTION_BUCKET: bucket,
    AUCTION_CACHE: kv,
  };
}

function createContext() {
  const pending = [];

  return {
    async flush() {
      await Promise.allSettled(pending);
    },
    waitUntil(promise) {
      pending.push(promise);
    },
  };
}

function createAuctionResponse(overrides = {}) {
  const body = {
    server: [{ id: 2_919_866 }],
    serverCount: 1,
    ...overrides,
  };

  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      ETag: '"auction-test"',
    },
    status: 200,
  });
}

describe("auction cache worker", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T02:00:00.000Z"));
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fetches Hetzner data and stores latest and historical R2 objects", async () => {
    const bucket = createR2Bucket();
    const env = createEnv({ bucket });
    fetchMock.mockResolvedValueOnce(createAuctionResponse());

    const response = await worker.fetch(
      new Request("https://auction.hctl.dev/live_data_sb_EUR.json"),
      env,
      createContext()
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Hctl-Auction-Source")).toBe(
      "hetzner-refresh"
    );
    expect(response.headers.get("X-Hctl-Auction-Stale")).toBe("false");
    expect(response.headers.get("Access-Control-Expose-Headers")).toContain(
      "X-Hctl-Auction-Updated-At"
    );
    await expect(response.json()).resolves.toMatchObject({ serverCount: 1 });

    const latest = bucket.objects.get("latest/live_data_sb_EUR.json");
    const history = bucket.objects.get(
      "history/2026/05/05/0200/live_data_sb_EUR.json"
    );
    expect(latest?.customMetadata).toMatchObject({
      historyKey: "history/2026/05/05/0200/live_data_sb_EUR.json",
      storage: "cloudflare-r2",
    });
    expect(history?.body).toBe(latest?.body);
    await expect(bucket.get("failures/EUR.json")).resolves.toBeNull();
  });

  it("serves stale cached R2 data and records refresh failures", async () => {
    const bucket = createR2Bucket();
    await bucket.put(
      "latest/live_data_sb_EUR.json",
      JSON.stringify({ server: [{ id: 1 }] }),
      {
        customMetadata: OLD_METADATA,
      }
    );
    const env = createEnv({ bucket });
    const ctx = createContext();
    fetchMock.mockResolvedValueOnce(
      new Response("bad gateway", { status: 502 })
    );

    const response = await worker.fetch(
      new Request("https://auction.hctl.dev/live_data_sb_EUR.json"),
      env,
      ctx
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Hctl-Auction-Source")).toBe("cloudflare-r2");
    expect(response.headers.get("X-Hctl-Auction-Stale")).toBe("true");
    await expect(response.json()).resolves.toMatchObject({
      server: [{ id: 1 }],
    });

    await ctx.flush();
    const failure = await bucket.get("failures/EUR.json");
    await expect(failure.text()).resolves.toContain("returned HTTP 502");
  });

  it("returns a retryable error when there is no cache and Hetzner fails", async () => {
    const bucket = createR2Bucket();
    const env = createEnv({ bucket });
    fetchMock.mockResolvedValueOnce(
      new Response("bad gateway", { status: 502 })
    );

    const response = await worker.fetch(
      new Request("https://auction.hctl.dev/live_data_sb_EUR.json"),
      env,
      createContext()
    );

    expect(response.status).toBe(502);
    expect(response.headers.get("Retry-After")).toBe("300");
    await expect(response.json()).resolves.toMatchObject({
      currency: "EUR",
      error: "Auction cache unavailable",
    });
    const failure = await bucket.get("failures/EUR.json");
    await expect(failure.text()).resolves.toContain("returned HTTP 502");
  });

  it("reports R2 failures and storage details in metadata and health responses", async () => {
    const bucket = createR2Bucket();
    await bucket.put("latest/live_data_sb_EUR.json", "{}", {
      customMetadata: OLD_METADATA,
    });
    await bucket.put("latest/live_data_sb_USD.json", "{}", {
      customMetadata: {
        ...OLD_METADATA,
        currency: "USD",
        historyKey: "history/2026/05/05/0000/live_data_sb_USD.json",
        latestKey: "latest/live_data_sb_USD.json",
      },
    });
    await bucket.put(
      "failures/EUR.json",
      JSON.stringify({
        currency: "EUR",
        failedAt: "2026-05-05T01:00:00.000Z",
        message: "Hetzner auction endpoint returned HTTP 502",
        sourceUrl:
          "https://www.hetzner.com/_resources/app/data/app/live_data_sb_EUR.json",
      })
    );
    const env = createEnv({ bucket });

    const metadataResponse = await worker.fetch(
      new Request("https://auction.hctl.dev/metadata.json"),
      env,
      createContext()
    );
    await expect(metadataResponse.json()).resolves.toMatchObject({
      failures: {
        EUR: {
          message: "Hetzner auction endpoint returned HTTP 502",
        },
      },
      historyPrefix: "history/",
      storage: "cloudflare-r2",
    });

    const healthResponse = await worker.fetch(
      new Request("https://auction.hctl.dev/health.json"),
      env,
      createContext()
    );
    expect(healthResponse.status).toBe(503);
    await expect(healthResponse.json()).resolves.toMatchObject({
      failedCurrencies: ["EUR"],
      ok: false,
      storage: "cloudflare-r2",
    });
  });
});
