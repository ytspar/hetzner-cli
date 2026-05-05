import type { AuctionServer } from "./types.js";

export interface DiffResult {
  added: AuctionServer[];
  priceChanged: PriceChange[];
  removed: AuctionServer[];
}

export interface PriceChange {
  previousPrice: number;
  server: AuctionServer;
}

export function computeDiff(
  previous: AuctionServer[],
  current: AuctionServer[]
): DiffResult {
  const prevMap = new Map<number, AuctionServer>();
  for (const s of previous) {
    prevMap.set(s.id, s);
  }

  const currMap = new Map<number, AuctionServer>();
  for (const s of current) {
    currMap.set(s.id, s);
  }

  const added: AuctionServer[] = [];
  const priceChanged: PriceChange[] = [];

  for (const server of current) {
    const prev = prevMap.get(server.id);
    if (!prev) {
      added.push(server);
    } else if (prev.price !== server.price) {
      priceChanged.push({ server, previousPrice: prev.price });
    }
  }

  const removed: AuctionServer[] = [];
  for (const server of previous) {
    if (!currMap.has(server.id)) {
      removed.push(server);
    }
  }

  return { added, removed, priceChanged };
}
