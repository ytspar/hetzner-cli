import { colorize, createTable, heading, info } from "../shared/formatter.js";
import type { AuctionServer } from "./types.js";

function summarizeDisks(server: AuctionServer): string {
  const parts: string[] = [];
  const { nvme, sata, hdd } = server.serverDiskData;
  if (nvme.length > 0) {
    parts.push(`${nvme.length}x ${formatDiskSize(nvme[0])} NVMe`);
  }
  if (sata.length > 0) {
    parts.push(`${sata.length}x ${formatDiskSize(sata[0])} SATA`);
  }
  if (hdd.length > 0) {
    parts.push(`${hdd.length}x ${formatDiskSize(hdd[0])} HDD`);
  }
  return parts.length > 0 ? parts.join(", ") : "-";
}

function formatDiskSize(gb: number): string {
  if (gb >= 1000) {
    return `${(gb / 1000).toFixed(gb % 1000 === 0 ? 0 : 1)} TB`;
  }
  return `${gb} GB`;
}

function formatNextReduce(server: AuctionServer): string {
  if (server.fixed_price) {
    return "Fixed";
  }
  if (server.next_reduce <= 0) {
    return "-";
  }
  const hours = Math.floor(server.next_reduce / 60);
  const mins = server.next_reduce % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function formatAuctionList(servers: AuctionServer[]): string {
  if (servers.length === 0) {
    return info("No auction servers found matching your filters.");
  }

  const table = createTable([
    "ID",
    "CPU",
    "RAM",
    "Disks",
    "DC",
    "Price",
    "Setup",
    "Type",
    "Reduce",
    "Specials",
  ]);

  for (const s of servers) {
    const specials = s.specials.length > 0 ? s.specials.join(", ") : "-";
    table.push([
      s.id.toString(),
      s.cpu,
      `${s.ram_size} GB${s.is_ecc ? " ECC" : ""}`,
      summarizeDisks(s),
      s.datacenter,
      `€${s.price.toFixed(2)}`,
      s.setup_price > 0 ? `€${s.setup_price.toFixed(2)}` : "Free",
      s.fixed_price ? "Fixed" : "Auction",
      formatNextReduce(s),
      specials,
    ]);
  }

  return `${table.toString()}\n${colorize(`${servers.length} server(s) found`, "gray")}`;
}

export function formatAuctionDetails(server: AuctionServer): string {
  const lines: string[] = [];

  lines.push(heading(`Auction Server ${server.id}`));
  lines.push("");

  const table = createTable(["Property", "Value"]);
  table.push(
    ["ID", server.id.toString()],
    ["Name", server.name],
    ["CPU", server.cpu],
    ["CPU Count", server.cpu_count.toString()],
    ["RAM", `${server.ram_size} GB${server.is_ecc ? " (ECC)" : ""}`],
    ["RAM Details", server.ram.join(", ")],
    ["Disks", summarizeDisks(server)],
    ["Disk Details", server.hdd_hr.join(", ") || "-"],
    ["Total Disk Size", `${server.hdd_size} GB`],
    ["Disk Count", server.hdd_count.toString()],
    ["Datacenter", `${server.datacenter_hr} (${server.datacenter})`],
    ["Traffic", server.traffic],
    ["Bandwidth", `${server.bandwidth} Mbit/s`],
    ["Price", `€${server.price.toFixed(2)}/mo`],
    ["Hourly Price", `€${server.hourly_price.toFixed(4)}/h`],
    [
      "Setup Price",
      server.setup_price > 0 ? `€${server.setup_price.toFixed(2)}` : "Free",
    ],
    ["Price Type", server.fixed_price ? "Fixed" : "Auction"],
    ["Next Reduce", formatNextReduce(server)],
    [
      "Specials",
      server.specials.length > 0 ? server.specials.join(", ") : "None",
    ],
    ["High I/O", server.is_highio ? "Yes" : "No"],
    ["ECC", server.is_ecc ? "Yes" : "No"]
  );

  lines.push(table.toString());

  // Disk breakdown
  const { nvme, sata, hdd } = server.serverDiskData;
  if (nvme.length > 0 || sata.length > 0 || hdd.length > 0) {
    lines.push("");
    lines.push(colorize("Disk Breakdown:", "bold"));
    if (nvme.length > 0) {
      lines.push(`  NVMe: ${nvme.map((d) => formatDiskSize(d)).join(", ")}`);
    }
    if (sata.length > 0) {
      lines.push(`  SATA: ${sata.map((d) => formatDiskSize(d)).join(", ")}`);
    }
    if (hdd.length > 0) {
      lines.push(`  HDD:  ${hdd.map((d) => formatDiskSize(d)).join(", ")}`);
    }
  }

  // IP Pricing
  lines.push("");
  lines.push(colorize("Additional IP Pricing:", "bold"));
  lines.push(`  Monthly: €${server.ip_price.Monthly.toFixed(2)}`);
  lines.push(`  Hourly:  €${server.ip_price.Hourly.toFixed(4)}`);

  // Description
  if (server.description.length > 0) {
    lines.push("");
    lines.push(colorize("Description:", "bold"));
    for (const line of server.description) {
      lines.push(`  ${line}`);
    }
  }

  return lines.join("\n");
}
