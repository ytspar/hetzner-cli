// ============================================================================
// Hetzner CLI - Main Library Export
// ============================================================================

// Auction Client
export {
  fetchAuctionServers,
  filterAuctionServers,
  sortAuctionServers,
} from "./auction/client.js";
// Auction Types
export type {
  AuctionDiskData,
  AuctionFilterOptions,
  AuctionIpPrice,
  AuctionResponse,
  AuctionServer,
} from "./auction/types.js";
// Cloud Client
export { HetznerCloudClient } from "./cloud/client.js";
// Cloud Context
export {
  createContext,
  deleteContext,
  getActiveContext,
  listContexts,
  resolveToken,
  useContext,
} from "./cloud/context.js";
// Cloud Types
export type {
  Certificate,
  CloudAction,
  CloudApiError,
  CloudFirewall,
  CloudFirewallAppliedTo,
  CloudFirewallRule,
  CloudServer,
  CloudSshKey,
  Datacenter,
  FloatingIp,
  Image,
  ISO,
  Labels,
  LoadBalancer,
  LoadBalancerService,
  LoadBalancerTarget,
  LoadBalancerType,
  Location,
  Network,
  NetworkRoute,
  NetworkSubnet,
  PaginationMeta,
  PlacementGroup,
  PrimaryIp,
  Protection,
  ServerType,
  ServerTypePrice,
  Volume,
} from "./cloud/types.js";
// Robot Client
export { HetznerRobotClient } from "./robot/client.js";
// Robot Types
export type {
  ApiError,
  // API
  ApiResponse,
  // Boot
  BootConfig,
  // Cancellation
  Cancellation,
  CpanelConfig,
  // Failover
  Failover,
  // Firewall
  Firewall,
  FirewallRule,
  FirewallTemplate,
  // IP
  IP,
  LinuxConfig,
  Mac,
  PleskConfig,
  ProductPrice,
  // Reverse DNS
  Rdns,
  RescueConfig,
  Reset,
  // Reset
  ResetType,
  // Server
  Server,
  ServerDetails,
  ServerMarketProduct,
  // Ordering
  ServerProduct,
  ServerSubnet,
  ServerTransaction,
  ServerTransactionProduct,
  // SSH Keys
  SshKey,
  // Storage Box
  StorageBox,
  StorageBoxSnapshot,
  StorageBoxSnapshotPlan,
  StorageBoxSubaccount,
  // Subnet
  Subnet,
  // Traffic
  Traffic,
  TrafficData,
  VncConfig,
  // vSwitch
  VSwitch,
  VSwitchCloudNetwork,
  VSwitchServer,
  VSwitchSubnet,
  WindowsConfig,
  // Wake on LAN
  Wol,
} from "./robot/types.js";
// Configuration utilities (for CLI integration)
export {
  type Config,
  clearConfig,
  getCredentials,
  hasCredentials,
  loadConfig,
  promptLogin,
  requireCredentials,
  saveConfig,
} from "./shared/config.js";
// Formatter utilities (for custom output)
export {
  colorize,
  colors,
  error,
  formatBytes,
  formatDate,
  formatDateTime,
  formatJson,
  formatStatus,
  heading,
  info,
  success,
  warning,
} from "./shared/formatter.js";
// Reference documentation (for LLM context)
export { generateReference } from "./shared/reference.js";
