// ============================================================================
// Hetzner Auction Types
// Public API: https://www.hetzner.com/_resources/app/data/app/live_data_sb_EUR.json
// ============================================================================

export interface AuctionDiskData {
  general: number[];
  hdd: number[];
  nvme: number[];
  sata: number[];
}

export interface AuctionIpPrice {
  Amount: number;
  Hourly: number;
  Monthly: number;
}

export interface AuctionServer {
  bandwidth: number;
  cat_id?: number;
  category?: string;
  cpu: string;
  cpu_count: number;
  datacenter: string;
  datacenter_hr: string;
  description: string[];
  dist: string[];
  fixed_price: boolean;
  hdd_arr: string[];
  hdd_count: number;
  hdd_hr: string[];
  hdd_size: number;
  hourly_price: number;
  id: number;
  information: string[] | null;
  ip_price: AuctionIpPrice;
  is_ecc: boolean;
  is_highio: boolean;
  key: number;
  name: string;
  next_reduce: number;
  next_reduce_hr: boolean;
  next_reduce_timestamp: number;
  price: number;
  ram: string[];
  ram_size: number;
  serverDiskData: AuctionDiskData;
  setup_price: number;
  specials: string[];
  traffic: string;
}

export interface AuctionFilterOptions {
  cpu?: string;
  datacenter?: string;
  diskType?: "nvme" | "sata" | "hdd";
  ecc?: boolean;
  fixedPrice?: boolean;
  gpu?: boolean;
  highio?: boolean;
  inic?: boolean;
  maxCpuCount?: number;
  maxDiskCount?: number;
  maxDiskSize?: number;
  maxHourlyPrice?: number;
  maxPrice?: number;
  maxRam?: number;
  maxSetupPrice?: number;
  minBandwidth?: number;
  minCpuCount?: number;
  minDiskCount?: number;
  minDiskSize?: number;
  minPrice?: number;
  minRam?: number;
  specials?: string;
  text?: string;
}

export interface AuctionResponse {
  server: AuctionServer[];
  serverCount: number;
}
