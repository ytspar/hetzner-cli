// Re-export from new location for backward compatibility

// Auction client (public API, no auth)
export {
  type AuctionFetchMetadata,
  type AuctionFetchOptions,
  type AuctionFetchResult,
  type AuctionSource,
  DEFAULT_AUCTION_CACHE_BASE_URL,
  fetchAuctionData,
  fetchAuctionServers,
  filterAuctionServers,
  getAuctionDataUrl,
  sortAuctionServers,
} from "./auction/client.js";
export { HetznerRobotClient } from "./robot/client.js";
