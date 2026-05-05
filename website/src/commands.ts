import type { AuctionServer } from "./data/auction.ts";
import {
  getCloudFirewallById,
  getCloudFirewalls,
  getCloudNetworkById,
  getCloudNetworks,
  getCloudServerByNameOrId,
  getCloudServers,
  getCloudVolumeById,
  getCloudVolumes,
} from "./data/cloud.ts";
import {
  type AuctionCurrency,
  type AuctionDataset,
  getAuctionCurrencySymbol,
  loadAuctionDataset,
  normalizeAuctionCurrency,
} from "./data/live-auction.ts";
import {
  getRobotServerById,
  getRobotServers,
  getSshKeys,
} from "./data/robot.ts";
import {
  formatDetail,
  formatError,
  formatInfo,
  formatJson,
  formatTable,
} from "./formatter.ts";
import {
  getAuctionHelp,
  getAuctionListHelp,
  getCloudFirewallHelp,
  getCloudHelp,
  getCloudNetworkHelp,
  getCloudServerHelp,
  getCloudVolumeHelp,
  getKeyHelp,
  getMainHelp,
  getServerHelp,
} from "./help.ts";
import { HCTL_VERSION } from "./version.ts";

interface ParsedArgs {
  flags: Record<string, string | boolean>;
  positional: string[];
}

function parseArgs(input: string): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  const tokens = input.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = tokens[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next.replace(/^"|"$/g, "");
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(token.replace(/^"|"$/g, ""));
    }
  }

  return { positional, flags };
}

function relativeTime(timestamp: number): string {
  if (timestamp === 0) {
    return "—";
  }
  const now = Math.floor(Date.now() / 1000);
  const diff = timestamp - now;
  if (diff <= 0) {
    return "expired";
  }
  const hours = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

// ---- Auction Commands ----

function applyAuctionFilters(
  servers: AuctionServer[],
  flags: Record<string, string | boolean>
): AuctionServer[] {
  let result = servers;
  if (flags["min-price"]) {
    result = result.filter((s) => s.price >= Number(flags["min-price"]));
  }
  if (flags["max-price"]) {
    result = result.filter((s) => s.price <= Number(flags["max-price"]));
  }
  if (flags["min-ram"]) {
    result = result.filter((s) => s.ram_size >= Number(flags["min-ram"]));
  }
  if (flags["max-ram"]) {
    result = result.filter((s) => s.ram_size <= Number(flags["max-ram"]));
  }
  if (flags.cpu) {
    const cpu = String(flags.cpu).toLowerCase();
    result = result.filter((s) => s.cpu.toLowerCase().includes(cpu));
  }
  if (flags.datacenter) {
    const dc = String(flags.datacenter).toLowerCase();
    result = result.filter((s) => s.datacenter.toLowerCase().includes(dc));
  }
  if (flags["disk-type"]) {
    const dt = String(flags["disk-type"]).toLowerCase();
    result = result.filter((s) => s.disk_type.toLowerCase().includes(dt));
  }
  if (flags.search) {
    const search = String(flags.search).toLowerCase();
    result = result.filter(
      (s) =>
        s.cpu.toLowerCase().includes(search) ||
        s.datacenter.toLowerCase().includes(search) ||
        s.hdd_text.toLowerCase().includes(search) ||
        s.disk_type.toLowerCase().includes(search) ||
        String(s.id).includes(search) ||
        s.name.toLowerCase().includes(search)
    );
  }
  if (flags.ecc) {
    result = result.filter((s) => s.ecc);
  }
  if (flags.gpu) {
    result = result.filter((s) => s.gpu);
  }
  if (flags.inic) {
    result = result.filter((s) => s.inic);
  }
  if (flags["fixed-price"]) {
    result = result.filter((s) => s.fixed_price);
  }
  if (flags["auction-only"]) {
    result = result.filter((s) => !s.fixed_price);
  }
  if (flags["no-setup-fee"]) {
    result = result.filter((s) => s.setup_price === 0);
  }
  return result;
}

async function auctionList(
  flags: Record<string, string | boolean>
): Promise<string> {
  if (flags.help) {
    return getAuctionListHelp();
  }

  const currency = normalizeAuctionCurrency(flags.currency);
  if (currency === null) {
    return formatError("Use --currency EUR or --currency USD.");
  }

  const auctionData = await loadAuctionDataset(currency);
  let servers = applyAuctionFilters(auctionData.servers, flags);

  // Sort
  if (flags.sort) {
    const field = String(flags.sort).toLowerCase();
    const sortFn = getSortFn(field);
    if (sortFn) {
      servers = [...servers].sort(sortFn);
    }
    if (flags.desc) {
      servers = servers.reverse();
    }
  }

  // Limit
  if (flags.limit) {
    servers = servers.slice(0, Number(flags.limit));
  }

  // JSON output
  if (flags.json) {
    return formatJson(servers);
  }

  const status = formatAuctionDatasetStatus(auctionData);

  if (servers.length === 0) {
    return `${status}${formatInfo("No servers match the specified filters.")}`;
  }

  const rows = servers.map((s) => ({
    id: s.id,
    cpu: truncate(s.cpu, 26),
    ram: `${s.ram_size} GB`,
    disk: truncate(s.hdd_text, 24),
    dc: s.datacenter,
    price: formatAuctionPrice(s.price, auctionData.currency),
    type: s.fixed_price ? "fixed" : "auction",
    reduce: s.fixed_price ? "—" : relativeTime(s.next_reduce_timestamp),
    specials: s.specials.join(", "),
  }));

  return `${status}${formatTable(
    [
      { key: "id", label: "ID", align: "right" },
      { key: "cpu", label: "CPU" },
      { key: "ram", label: "RAM", align: "right" },
      { key: "disk", label: "Disks" },
      { key: "dc", label: "Datacenter" },
      { key: "price", label: "Price", align: "right", color: "c-green" },
      { key: "type", label: "Type" },
      { key: "reduce", label: "Next Reduce" },
      { key: "specials", label: "Specials" },
    ],
    rows,
    `${servers.length} server${servers.length === 1 ? "" : "s"} found`
  )}`;
}

function formatAuctionDatasetStatus(dataset: AuctionDataset): string {
  if (!dataset.isLive) {
    const error = dataset.errorMessage ? ` (${dataset.errorMessage})` : "";
    return formatInfo(
      `Auction data: hosted ${dataset.requestedCurrency} cache unavailable${error}; showing bundled EUR demo data.`
    );
  }

  const stale = dataset.metadata.stale ? " stale" : "";
  return formatInfo(
    `Auction data: ${dataset.servers.length} ${dataset.currency} servers from hosted cache${formatAuctionUpdatedPart(
      dataset
    )}${stale}.`
  );
}

function formatAuctionUpdatedPart(dataset: AuctionDataset): string {
  const updatedAt = dataset.metadata.updatedAt;
  if (updatedAt === undefined) {
    return "";
  }

  const updatedDate = new Date(updatedAt);
  if (Number.isNaN(updatedDate.getTime())) {
    return "";
  }

  const formattedTime = updatedDate.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `, updated ${formattedTime}${formatAuctionAge(dataset)}`;
}

function formatAuctionAge(dataset: AuctionDataset): string {
  const ageSeconds = getAuctionAgeSeconds(dataset);
  if (ageSeconds === undefined) {
    return "";
  }
  return ` (${formatElapsedAge(ageSeconds)})`;
}

function getAuctionAgeSeconds(dataset: AuctionDataset): number | undefined {
  if (dataset.metadata.ageSeconds !== undefined) {
    return dataset.metadata.ageSeconds;
  }

  const updatedAt = dataset.metadata.updatedAt;
  if (updatedAt === undefined) {
    return undefined;
  }

  const updatedTime = Date.parse(updatedAt);
  if (Number.isNaN(updatedTime)) {
    return undefined;
  }

  return Math.max(0, Math.floor((Date.now() - updatedTime) / 1000));
}

function formatElapsedAge(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds}s ago`;
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m ago`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) {
    return minutes > 0 ? `${hours}h ${minutes}m ago` : `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0
    ? `${days}d ${remainingHours}h ago`
    : `${days}d ago`;
}

function formatAuctionPrice(value: number, currency: AuctionCurrency): string {
  const amount = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return `${getAuctionCurrencySymbol(currency)}${amount}`;
}

async function auctionStatus(
  flags: Record<string, string | boolean>
): Promise<string> {
  const currency = normalizeAuctionCurrency(flags.currency);
  if (currency === null) {
    return formatError("Use --currency EUR or --currency USD.");
  }

  const auctionData = await loadAuctionDataset(currency);
  const status = {
    ageSeconds: getAuctionAgeSeconds(auctionData),
    currency: auctionData.currency,
    endpointUrl: auctionData.metadata.url,
    isLive: auctionData.isLive,
    requestedCurrency: auctionData.requestedCurrency,
    serverCount: auctionData.servers.length,
    source: auctionData.isLive
      ? (auctionData.metadata.source ?? "hosted-cache")
      : "bundled-demo",
    stale: auctionData.metadata.stale ?? !auctionData.isLive,
    updatedAt: auctionData.metadata.updatedAt,
  };

  if (flags.json) {
    return formatJson(status);
  }

  return formatDetail("Auction Status", [
    ["Currency", status.currency],
    ["Endpoint", status.endpointUrl],
    ["Source", status.source],
    ["Server Count", String(status.serverCount)],
    ["Updated", status.updatedAt ?? "—"],
    [
      "Age",
      status.ageSeconds === undefined
        ? "—"
        : formatElapsedAge(status.ageSeconds),
    ],
    ["Stale", status.stale ? "Yes" : "No"],
    ["Live", status.isLive ? "Yes" : "No"],
  ]);
}

function getSortFn(
  field: string
): ((a: AuctionServer, b: AuctionServer) => number) | null {
  switch (field) {
    case "price":
      return (a, b) => a.price - b.price;
    case "ram":
      return (a, b) => a.ram_size - b.ram_size;
    case "cpu":
      return (a, b) => a.cpu.localeCompare(b.cpu);
    case "datacenter":
    case "dc":
      return (a, b) => a.datacenter.localeCompare(b.datacenter);
    case "id":
      return (a, b) => a.id - b.id;
    case "benchmark":
      return (a, b) => a.cpu_benchmark - b.cpu_benchmark;
    default:
      return null;
  }
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) {
    return s;
  }
  return `${s.slice(0, maxLen - 1)}…`;
}

async function auctionShow(
  idStr: string,
  flags: Record<string, string | boolean>
): Promise<string> {
  const id = Number.parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    return formatError("Please provide a valid server ID.");
  }

  const currency = normalizeAuctionCurrency(flags.currency);
  if (currency === null) {
    return formatError("Use --currency EUR or --currency USD.");
  }

  const auctionData = await loadAuctionDataset(currency);
  const s = auctionData.servers.find((server) => server.id === id);
  if (!s) {
    return `${formatAuctionDatasetStatus(auctionData)}${formatError(
      `Server with ID ${id} not found.`
    )}`;
  }

  return `${formatAuctionDatasetStatus(auctionData)}${formatDetail(
    `Auction Server #${s.id}`,
    [
      ["ID", String(s.id)],
      ["Name", s.name],
      ["CPU", s.cpu],
      ["CPU Benchmark", String(s.cpu_benchmark)],
      ["CPU Count", `${s.cpu_count} cores`],
      ["RAM", `${s.ram_size} GB`],
      ["RAM Details", s.ram.join(", ")],
      ["Disks", s.hdd_text],
      ["Disk Type", s.disk_type],
      ["Datacenter", s.datacenter],
      [
        "Price",
        `${formatAuctionPrice(s.price, auctionData.currency)}/month`,
        "c-green",
      ],
      [
        "Setup Fee",
        s.setup_price > 0
          ? formatAuctionPrice(s.setup_price, auctionData.currency)
          : "None",
        s.setup_price > 0 ? "c-yellow" : "c-green",
      ],
      ["Type", s.fixed_price ? "Fixed Price" : "Auction"],
      [
        "Next Reduce",
        s.fixed_price ? "—" : relativeTime(s.next_reduce_timestamp),
      ],
      ["ECC", s.ecc ? "Yes" : "No", s.ecc ? "c-green" : "c-dim"],
      ["GPU", s.gpu ? "Yes" : "No", s.gpu ? "c-green" : "c-dim"],
      ["iNIC", s.inic ? "Yes" : "No", s.inic ? "c-green" : "c-dim"],
      ["IPv4", s.ipv4 ? "Yes" : "No", s.ipv4 ? "c-green" : "c-dim"],
      ["Traffic", s.traffic],
      ["Bandwidth", `${s.bandwidth} Mbit/s`],
    ]
  )}`;
}

// ---- Cloud Commands ----

function cloudServerList(): string {
  const servers = getCloudServers();
  const rows = servers.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    type: s.server_type,
    dc: s.datacenter,
    ipv4: s.public_ipv4,
    image: s.image,
  }));

  return formatTable(
    [
      { key: "id", label: "ID", align: "right" },
      { key: "name", label: "Name", color: "c-cyan" },
      { key: "status", label: "Status", color: "c-green" },
      { key: "type", label: "Type" },
      { key: "dc", label: "Datacenter" },
      { key: "ipv4", label: "IPv4" },
      { key: "image", label: "Image" },
    ],
    rows,
    `${servers.length} server${servers.length === 1 ? "" : "s"}`
  );
}

function cloudServerDescribe(nameOrId: string): string {
  const s = getCloudServerByNameOrId(nameOrId);
  if (!s) {
    return formatError(`Server "${nameOrId}" not found.`);
  }

  const labels = Object.entries(s.labels)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  return formatDetail(`Cloud Server: ${s.name}`, [
    ["ID", String(s.id)],
    ["Name", s.name, "c-cyan"],
    ["Status", s.status, s.status === "running" ? "c-green" : "c-yellow"],
    ["Server Type", s.server_type],
    ["Datacenter", s.datacenter],
    ["Public IPv4", s.public_ipv4],
    ["Public IPv6", s.public_ipv6],
    ["Private IP", s.private_ip || "—"],
    ["Image", s.image],
    ["Created", s.created],
    ["Labels", labels || "—"],
    ["Volumes", s.volumes.length > 0 ? s.volumes.join(", ") : "—"],
  ]);
}

function cloudNetworkList(): string {
  const networks = getCloudNetworks();
  const rows = networks.map((n) => ({
    id: n.id,
    name: n.name,
    ip_range: n.ip_range,
    subnets: n.subnets.length,
    servers: n.servers.length,
  }));

  return formatTable(
    [
      { key: "id", label: "ID", align: "right" },
      { key: "name", label: "Name", color: "c-cyan" },
      { key: "ip_range", label: "IP Range" },
      { key: "subnets", label: "Subnets", align: "right" },
      { key: "servers", label: "Servers", align: "right" },
    ],
    rows,
    `${networks.length} network${networks.length === 1 ? "" : "s"}`
  );
}

function cloudNetworkDescribe(idStr: string): string {
  const id = Number.parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    return formatError("Please provide a valid network ID.");
  }
  const n = getCloudNetworkById(id);
  if (!n) {
    return formatError(`Network ${id} not found.`);
  }

  const labels = Object.entries(n.labels)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  const subnets = n.subnets
    .map((s) => `${s.ip_range} (${s.network_zone})`)
    .join(", ");

  return formatDetail(`Network: ${n.name}`, [
    ["ID", String(n.id)],
    ["Name", n.name, "c-cyan"],
    ["IP Range", n.ip_range],
    ["Subnets", subnets],
    ["Servers", n.servers.join(", ") || "—"],
    ["Created", n.created],
    ["Labels", labels || "—"],
  ]);
}

function cloudFirewallList(): string {
  const firewalls = getCloudFirewalls();
  const rows = firewalls.map((f) => ({
    id: f.id,
    name: f.name,
    rules: f.rules.length,
    applied: f.applied_to.length,
  }));

  return formatTable(
    [
      { key: "id", label: "ID", align: "right" },
      { key: "name", label: "Name", color: "c-cyan" },
      { key: "rules", label: "Rules", align: "right" },
      { key: "applied", label: "Applied To", align: "right" },
    ],
    rows,
    `${firewalls.length} firewall${firewalls.length === 1 ? "" : "s"}`
  );
}

function cloudFirewallDescribe(idStr: string): string {
  const id = Number.parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    return formatError("Please provide a valid firewall ID.");
  }
  const f = getCloudFirewallById(id);
  if (!f) {
    return formatError(`Firewall ${id} not found.`);
  }

  const labels = Object.entries(f.labels)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  const appliedTo = f.applied_to.map((a) => `server:${a.server.id}`).join(", ");

  const props: [string, string, string?][] = [
    ["ID", String(f.id)],
    ["Name", f.name, "c-cyan"],
    ["Applied To", appliedTo || "—"],
    ["Created", f.created],
    ["Labels", labels || "—"],
    ["", ""],
    ["Rules", ""],
  ];

  for (const rule of f.rules) {
    props.push([
      `  ${rule.direction.toUpperCase()} ${rule.protocol}/${rule.port}`,
      `${rule.source_ips.join(", ")} — ${rule.description}`,
      "c-dim",
    ]);
  }

  return formatDetail(`Firewall: ${f.name}`, props);
}

function cloudVolumeList(): string {
  const volumes = getCloudVolumes();
  const rows = volumes.map((v) => ({
    id: v.id,
    name: v.name,
    size: `${v.size} GB`,
    server: v.server || "—",
    location: v.location,
    format: v.format,
    status: v.status,
  }));

  return formatTable(
    [
      { key: "id", label: "ID", align: "right" },
      { key: "name", label: "Name", color: "c-cyan" },
      { key: "size", label: "Size", align: "right" },
      { key: "server", label: "Server", align: "right" },
      { key: "location", label: "Location" },
      { key: "format", label: "Format" },
      { key: "status", label: "Status", color: "c-green" },
    ],
    rows,
    `${volumes.length} volume${volumes.length === 1 ? "" : "s"}`
  );
}

function cloudVolumeDescribe(idStr: string): string {
  const id = Number.parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    return formatError("Please provide a valid volume ID.");
  }
  const v = getCloudVolumeById(id);
  if (!v) {
    return formatError(`Volume ${id} not found.`);
  }

  const labels = Object.entries(v.labels)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  return formatDetail(`Volume: ${v.name}`, [
    ["ID", String(v.id)],
    ["Name", v.name, "c-cyan"],
    ["Size", `${v.size} GB`],
    ["Server", v.server ? String(v.server) : "Not attached"],
    ["Location", v.location],
    ["Format", v.format],
    ["Status", v.status, v.status === "available" ? "c-green" : "c-yellow"],
    ["Linux Device", v.linux_device],
    ["Created", v.created],
    ["Labels", labels || "—"],
  ]);
}

// ---- Robot Commands ----

function robotServerList(): string {
  const servers = getRobotServers();
  const rows = servers.map((s) => ({
    id: s.server_number,
    name: s.server_name,
    product: s.product,
    dc: s.dc,
    ip: s.server_ip,
    status: s.status,
    paid_until: s.paid_until,
  }));

  return formatTable(
    [
      { key: "id", label: "ID", align: "right" },
      { key: "name", label: "Name", color: "c-cyan" },
      { key: "product", label: "Product" },
      { key: "dc", label: "Datacenter" },
      { key: "ip", label: "IP" },
      { key: "status", label: "Status", color: "c-green" },
      { key: "paid_until", label: "Paid Until" },
    ],
    rows,
    `${servers.length} server${servers.length === 1 ? "" : "s"}`
  );
}

function robotServerGet(idStr: string): string {
  const id = Number.parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    return formatError("Please provide a valid server number.");
  }
  const s = getRobotServerById(id);
  if (!s) {
    return formatError(`Server ${id} not found.`);
  }

  return formatDetail(`Dedicated Server #${s.server_number}`, [
    ["Server Number", String(s.server_number)],
    ["Name", s.server_name, "c-cyan"],
    ["Product", s.product],
    ["Datacenter", s.dc],
    ["Status", s.status, s.status === "ready" ? "c-green" : "c-yellow"],
    ["IPv4", s.server_ip],
    ["IPv6", s.server_ipv6_net],
    ["Traffic", s.traffic],
    [
      "Cancelled",
      s.cancelled ? "Yes" : "No",
      s.cancelled ? "c-red" : "c-green",
    ],
    ["Paid Until", s.paid_until],
  ]);
}

function robotKeyList(): string {
  const keys = getSshKeys();
  const rows = keys.map((k) => ({
    name: k.name,
    type: k.type,
    size: k.size,
    fingerprint: k.fingerprint,
  }));

  return formatTable(
    [
      { key: "name", label: "Name", color: "c-cyan" },
      { key: "type", label: "Type" },
      { key: "size", label: "Size", align: "right" },
      { key: "fingerprint", label: "Fingerprint" },
    ],
    rows,
    `${keys.length} key${keys.length === 1 ? "" : "s"}`
  );
}

// ---- Command Dispatcher ----

function dispatchCloudResource(
  resource: string,
  action: string | undefined,
  positional: string[],
  flags: Record<string, string | boolean>
): string {
  if (resource === "server") {
    return dispatchCloudAction(action, positional[3], flags, {
      help: getCloudServerHelp,
      list: cloudServerList,
      describe: cloudServerDescribe,
      errorPrefix: "cloud server",
      describeUsage: "Usage: cloud server describe <name|id>",
    });
  }
  if (resource === "network") {
    return dispatchCloudAction(action, positional[3], flags, {
      help: getCloudNetworkHelp,
      list: cloudNetworkList,
      describe: cloudNetworkDescribe,
      errorPrefix: "cloud network",
      describeUsage: "Usage: cloud network describe <id>",
    });
  }
  if (resource === "firewall") {
    return dispatchCloudAction(action, positional[3], flags, {
      help: getCloudFirewallHelp,
      list: cloudFirewallList,
      describe: cloudFirewallDescribe,
      errorPrefix: "cloud firewall",
      describeUsage: "Usage: cloud firewall describe <id>",
    });
  }
  if (resource === "volume") {
    return dispatchCloudAction(action, positional[3], flags, {
      help: getCloudVolumeHelp,
      list: cloudVolumeList,
      describe: cloudVolumeDescribe,
      errorPrefix: "cloud volume",
      describeUsage: "Usage: cloud volume describe <id>",
    });
  }
  return formatError(
    `Unknown cloud resource: ${resource}. Run "cloud --help" for usage.`
  );
}

function dispatchCloudAction(
  action: string | undefined,
  identifier: string | undefined,
  flags: Record<string, string | boolean>,
  config: {
    help: () => string;
    list: () => string;
    describe: (id: string) => string;
    errorPrefix: string;
    describeUsage: string;
  }
): string {
  if (!action || flags.help === true) {
    return config.help();
  }
  if (action === "list" || action === "ls") {
    return config.list();
  }
  if (action === "describe" || action === "get" || action === "show") {
    if (!identifier) {
      return formatError(config.describeUsage);
    }
    return config.describe(identifier);
  }
  return formatError(
    `Unknown action: ${action}. Run "${config.errorPrefix} --help" for usage.`
  );
}

function dispatchAuction(
  positional: string[],
  flags: Record<string, string | boolean>
): string | Promise<string> {
  if (
    positional.length < 2 ||
    (flags.help === true && positional.length === 1)
  ) {
    return getAuctionHelp();
  }
  const sub = positional[1];
  if (sub === "list" || sub === "ls") {
    return auctionList(flags);
  }
  if (sub === "show") {
    if (!positional[2]) {
      return formatError("Usage: auction show <id>");
    }
    return auctionShow(positional[2], flags);
  }
  if (sub === "status") {
    return auctionStatus(flags);
  }
  return formatError(
    `Unknown auction command: ${sub}. Run "auction --help" for usage.`
  );
}

function dispatchCloud(
  positional: string[],
  flags: Record<string, string | boolean>
): string {
  if (
    positional.length < 2 ||
    (flags.help === true && positional.length === 1)
  ) {
    return getCloudHelp();
  }
  return dispatchCloudResource(positional[1], positional[2], positional, flags);
}

function dispatchServer(
  positional: string[],
  flags: Record<string, string | boolean>
): string {
  if (positional.length < 2 || flags.help === true) {
    return getServerHelp();
  }
  const sub = positional[1];
  if (sub === "list" || sub === "ls") {
    return robotServerList();
  }
  if (sub === "get" || sub === "show") {
    if (!positional[2]) {
      return formatError("Usage: server get <id>");
    }
    return robotServerGet(positional[2]);
  }
  return formatError(`Unknown server command: ${sub}`);
}

function dispatchKey(
  positional: string[],
  flags: Record<string, string | boolean>
): string {
  if (positional.length < 2 || flags.help === true) {
    return getKeyHelp();
  }
  const sub = positional[1];
  if (sub === "list" || sub === "ls") {
    return robotKeyList();
  }
  return formatError(`Unknown key command: ${sub}`);
}

export function executeCommand(input: string): string | Promise<string> {
  const { positional, flags } = parseArgs(input);

  if (
    positional.length === 0 ||
    (flags.help === true && positional.length === 0)
  ) {
    return getMainHelp();
  }

  if (
    flags.version ||
    (positional.length === 1 && positional[0] === "version")
  ) {
    return formatInfo(`hctl v${HCTL_VERSION}`);
  }

  const cmd = positional[0];

  switch (cmd) {
    case "help":
      return getMainHelp();
    case "version":
      return formatInfo(`hctl v${HCTL_VERSION}`);
    case "auction":
      return dispatchAuction(positional, flags);
    case "cloud":
      return dispatchCloud(positional, flags);
    case "server":
      return dispatchServer(positional, flags);
    case "key":
      return dispatchKey(positional, flags);
    default:
      return formatError(
        `Unknown command: "${cmd}". Run "help" for available commands.`
      );
  }
}
