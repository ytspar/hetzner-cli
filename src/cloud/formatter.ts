import {
  colorize,
  createTable,
  formatBytes,
  formatDate,
  formatStatus,
  heading,
  info,
} from "../shared/formatter.js";
import type {
  Certificate,
  CloudFirewall,
  CloudServer,
  CloudSshKey,
  Datacenter,
  FloatingIp,
  Image,
  ISO,
  LoadBalancer,
  LoadBalancerType,
  Location,
  Network,
  PlacementGroup,
  PrimaryIp,
  ServerType,
  Volume,
} from "./types.js";

// Context
export function formatContextList(
  contexts: { name: string; active: boolean }[]
): string {
  if (contexts.length === 0) {
    return info("No contexts configured. Run: hctl cloud context create");
  }

  const table = createTable(["Name", "Active"]);
  for (const ctx of contexts) {
    table.push([ctx.name, ctx.active ? colorize("*", "green") : ""]);
  }
  return table.toString();
}

// Datacenters
export function formatDatacenterList(datacenters: Datacenter[]): string {
  if (datacenters.length === 0) {
    return info("No datacenters found.");
  }
  const table = createTable(["ID", "Name", "Description", "Location"]);
  for (const dc of datacenters) {
    table.push([dc.id.toString(), dc.name, dc.description, dc.location.name]);
  }
  return table.toString();
}

export function formatDatacenterDetails(dc: Datacenter): string {
  const lines: string[] = [];
  lines.push(heading(`Datacenter: ${dc.name}`));
  lines.push("");
  const table = createTable(["Property", "Value"]);
  table.push(
    ["ID", dc.id.toString()],
    ["Name", dc.name],
    ["Description", dc.description],
    ["Location", dc.location.description],
    ["City", dc.location.city],
    ["Country", dc.location.country],
    ["Network Zone", dc.location.network_zone]
  );
  lines.push(table.toString());
  return lines.join("\n");
}

// Locations
export function formatLocationList(locations: Location[]): string {
  if (locations.length === 0) {
    return info("No locations found.");
  }
  const table = createTable([
    "ID",
    "Name",
    "Description",
    "City",
    "Country",
    "Network Zone",
  ]);
  for (const loc of locations) {
    table.push([
      loc.id.toString(),
      loc.name,
      loc.description,
      loc.city,
      loc.country,
      loc.network_zone,
    ]);
  }
  return table.toString();
}

export function formatLocationDetails(loc: Location): string {
  const lines: string[] = [];
  lines.push(heading(`Location: ${loc.name}`));
  lines.push("");
  const table = createTable(["Property", "Value"]);
  table.push(
    ["ID", loc.id.toString()],
    ["Name", loc.name],
    ["Description", loc.description],
    ["City", loc.city],
    ["Country", loc.country],
    ["Latitude", loc.latitude.toString()],
    ["Longitude", loc.longitude.toString()],
    ["Network Zone", loc.network_zone]
  );
  lines.push(table.toString());
  return lines.join("\n");
}

// Server Types
export function formatServerTypeList(types: ServerType[]): string {
  if (types.length === 0) {
    return info("No server types found.");
  }
  const table = createTable([
    "ID",
    "Name",
    "Cores",
    "Memory",
    "Disk",
    "Storage",
    "CPU",
    "Arch",
  ]);
  for (const st of types) {
    table.push([
      st.id.toString(),
      st.name,
      st.cores.toString(),
      `${st.memory} GB`,
      `${st.disk} GB`,
      st.storage_type,
      st.cpu_type,
      st.architecture,
    ]);
  }
  return table.toString();
}

export function formatServerTypeDetails(st: ServerType): string {
  const lines: string[] = [];
  lines.push(heading(`Server Type: ${st.name}`));
  lines.push("");
  const table = createTable(["Property", "Value"]);
  table.push(
    ["ID", st.id.toString()],
    ["Name", st.name],
    ["Description", st.description],
    ["Cores", st.cores.toString()],
    ["Memory", `${st.memory} GB`],
    ["Disk", `${st.disk} GB`],
    ["Storage Type", st.storage_type],
    ["CPU Type", st.cpu_type],
    ["Architecture", st.architecture],
    ["Deprecated", st.deprecated ? colorize("Yes", "red") : "No"]
  );
  lines.push(table.toString());

  if (st.prices.length > 0) {
    lines.push("");
    lines.push(colorize("Pricing:", "bold"));
    const priceTable = createTable([
      "Location",
      "Hourly",
      "Monthly",
      "Traffic",
    ]);
    for (const p of st.prices) {
      priceTable.push([
        p.location,
        `€${p.price_hourly.gross}`,
        `€${p.price_monthly.gross}`,
        formatBytes(p.included_traffic),
      ]);
    }
    lines.push(priceTable.toString());
  }
  return lines.join("\n");
}

// Load Balancer Types
export function formatLoadBalancerTypeList(types: LoadBalancerType[]): string {
  if (types.length === 0) {
    return info("No load balancer types found.");
  }
  const table = createTable([
    "ID",
    "Name",
    "Description",
    "Max Conn",
    "Max Services",
    "Max Targets",
  ]);
  for (const lbt of types) {
    table.push([
      lbt.id.toString(),
      lbt.name,
      lbt.description,
      lbt.max_connections.toString(),
      lbt.max_services.toString(),
      lbt.max_targets.toString(),
    ]);
  }
  return table.toString();
}

export function formatLoadBalancerTypeDetails(lbt: LoadBalancerType): string {
  const lines: string[] = [];
  lines.push(heading(`Load Balancer Type: ${lbt.name}`));
  lines.push("");
  const table = createTable(["Property", "Value"]);
  table.push(
    ["ID", lbt.id.toString()],
    ["Name", lbt.name],
    ["Description", lbt.description],
    ["Max Connections", lbt.max_connections.toString()],
    ["Max Services", lbt.max_services.toString()],
    ["Max Targets", lbt.max_targets.toString()],
    ["Max Certificates", lbt.max_assigned_certificates.toString()],
    ["Deprecated", lbt.deprecated ? colorize("Yes", "red") : "No"]
  );
  lines.push(table.toString());
  return lines.join("\n");
}

// ISOs
export function formatIsoList(isos: ISO[]): string {
  if (isos.length === 0) {
    return info("No ISOs found.");
  }
  const table = createTable(["ID", "Name", "Type", "Architecture"]);
  for (const iso of isos) {
    table.push([
      iso.id.toString(),
      iso.name,
      iso.type,
      iso.architecture || "-",
    ]);
  }
  return table.toString();
}

export function formatIsoDetails(iso: ISO): string {
  const lines: string[] = [];
  lines.push(heading(`ISO: ${iso.name}`));
  lines.push("");
  const table = createTable(["Property", "Value"]);
  table.push(
    ["ID", iso.id.toString()],
    ["Name", iso.name],
    ["Description", iso.description],
    ["Type", iso.type],
    ["Architecture", iso.architecture || "-"]
  );
  lines.push(table.toString());
  return lines.join("\n");
}

// Cloud Servers
export function formatCloudServerList(servers: CloudServer[]): string {
  if (servers.length === 0) {
    return info("No servers found.");
  }
  const table = createTable([
    "ID",
    "Name",
    "Status",
    "Type",
    "DC",
    "IPv4",
    "Labels",
  ]);
  for (const srv of servers) {
    const labels =
      Object.entries(srv.labels)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ") || "-";
    table.push([
      srv.id.toString(),
      srv.name,
      formatStatus(srv.status),
      srv.server_type.name,
      srv.datacenter.name,
      srv.public_net.ipv4?.ip || "-",
      labels.length > 30 ? `${labels.substring(0, 27)}...` : labels,
    ]);
  }
  return table.toString();
}

export function formatCloudServerDetails(srv: CloudServer): string {
  const lines: string[] = [];
  lines.push(heading(`Server: ${srv.name}`));
  lines.push("");
  const table = createTable(["Property", "Value"]);
  table.push(
    ["ID", srv.id.toString()],
    ["Name", srv.name],
    ["Status", formatStatus(srv.status)],
    [
      "Server Type",
      `${srv.server_type.name} (${srv.server_type.cores} cores, ${srv.server_type.memory} GB RAM)`,
    ],
    ["Datacenter", `${srv.datacenter.name} (${srv.datacenter.location.city})`],
    [
      "Image",
      srv.image
        ? `${srv.image.description} (${srv.image.name || srv.image.id})`
        : "-",
    ],
    ["IPv4", srv.public_net.ipv4?.ip || "-"],
    ["IPv6", srv.public_net.ipv6?.ip || "-"],
    ["Primary Disk", `${srv.primary_disk_size} GB`],
    ["Rescue", srv.rescue_enabled ? colorize("Enabled", "yellow") : "Disabled"],
    ["Locked", srv.locked ? colorize("Yes", "red") : "No"],
    ["Backup Window", srv.backup_window || "Disabled"],
    [
      "Protection",
      srv.protection.delete ? colorize("Delete protected", "yellow") : "None",
    ],
    ["Created", formatDate(srv.created)]
  );
  lines.push(table.toString());

  if (Object.keys(srv.labels).length > 0) {
    lines.push("");
    lines.push(colorize("Labels:", "bold"));
    for (const [k, v] of Object.entries(srv.labels)) {
      lines.push(`  ${k} = ${v}`);
    }
  }

  if (srv.private_net.length > 0) {
    lines.push("");
    lines.push(colorize("Private Networks:", "bold"));
    const netTable = createTable(["Network", "IP", "Alias IPs"]);
    for (const pn of srv.private_net) {
      netTable.push([
        pn.network.toString(),
        pn.ip,
        pn.alias_ips.join(", ") || "-",
      ]);
    }
    lines.push(netTable.toString());
  }

  if (srv.volumes.length > 0) {
    lines.push("");
    lines.push(colorize("Volumes:", "bold"));
    lines.push(`  ${srv.volumes.join(", ")}`);
  }

  return lines.join("\n");
}

// Networks
export function formatNetworkList(networks: Network[]): string {
  if (networks.length === 0) {
    return info("No networks found.");
  }
  const table = createTable(["ID", "Name", "IP Range", "Subnets", "Servers"]);
  for (const net of networks) {
    table.push([
      net.id.toString(),
      net.name,
      net.ip_range,
      net.subnets.length.toString(),
      net.servers.length.toString(),
    ]);
  }
  return table.toString();
}

export function formatNetworkDetails(net: Network): string {
  const lines: string[] = [];
  lines.push(heading(`Network: ${net.name}`));
  lines.push("");
  const table = createTable(["Property", "Value"]);
  table.push(
    ["ID", net.id.toString()],
    ["Name", net.name],
    ["IP Range", net.ip_range],
    ["Servers", net.servers.length.toString()],
    [
      "Protection",
      net.protection.delete ? colorize("Delete protected", "yellow") : "None",
    ],
    ["Created", formatDate(net.created)]
  );
  lines.push(table.toString());
  if (net.subnets.length > 0) {
    lines.push("");
    lines.push(colorize("Subnets:", "bold"));
    const subTable = createTable([
      "IP Range",
      "Type",
      "Network Zone",
      "Gateway",
    ]);
    for (const s of net.subnets) {
      subTable.push([s.ip_range, s.type, s.network_zone, s.gateway]);
    }
    lines.push(subTable.toString());
  }
  if (net.routes.length > 0) {
    lines.push("");
    lines.push(colorize("Routes:", "bold"));
    const routeTable = createTable(["Destination", "Gateway"]);
    for (const r of net.routes) {
      routeTable.push([r.destination, r.gateway]);
    }
    lines.push(routeTable.toString());
  }
  return lines.join("\n");
}

// Cloud Firewalls
export function formatCloudFirewallList(firewalls: CloudFirewall[]): string {
  if (firewalls.length === 0) {
    return info("No firewalls found.");
  }
  const table = createTable(["ID", "Name", "Rules", "Applied To", "Created"]);
  for (const fw of firewalls) {
    table.push([
      fw.id.toString(),
      fw.name,
      fw.rules.length.toString(),
      fw.applied_to.length.toString(),
      formatDate(fw.created),
    ]);
  }
  return table.toString();
}

export function formatCloudFirewallDetails(fw: CloudFirewall): string {
  const lines: string[] = [];
  lines.push(heading(`Firewall: ${fw.name}`));
  lines.push("");
  const table = createTable(["Property", "Value"]);
  table.push(
    ["ID", fw.id.toString()],
    ["Name", fw.name],
    ["Created", formatDate(fw.created)]
  );
  lines.push(table.toString());
  if (fw.rules.length > 0) {
    lines.push("");
    lines.push(colorize("Rules:", "bold"));
    const ruleTable = createTable([
      "Direction",
      "Protocol",
      "Port",
      "Source IPs",
      "Description",
    ]);
    for (const r of fw.rules) {
      ruleTable.push([
        r.direction,
        r.protocol,
        r.port || "any",
        r.source_ips.join(", ").substring(0, 30) || "-",
        r.description || "-",
      ]);
    }
    lines.push(ruleTable.toString());
  }
  return lines.join("\n");
}

// Floating IPs
export function formatFloatingIpList(ips: FloatingIp[]): string {
  if (ips.length === 0) {
    return info("No floating IPs found.");
  }
  const table = createTable([
    "ID",
    "Name",
    "IP",
    "Type",
    "Server",
    "Location",
    "Blocked",
  ]);
  for (const ip of ips) {
    table.push([
      ip.id.toString(),
      ip.name,
      ip.ip,
      ip.type,
      ip.server?.toString() || "-",
      ip.home_location.name,
      ip.blocked ? colorize("Yes", "red") : "No",
    ]);
  }
  return table.toString();
}

export function formatFloatingIpDetails(ip: FloatingIp): string {
  const lines: string[] = [];
  lines.push(heading(`Floating IP: ${ip.name}`));
  lines.push("");
  const table = createTable(["Property", "Value"]);
  table.push(
    ["ID", ip.id.toString()],
    ["Name", ip.name],
    ["Description", ip.description || "-"],
    ["IP", ip.ip],
    ["Type", ip.type],
    ["Server", ip.server?.toString() || "Unassigned"],
    ["Home Location", ip.home_location.name],
    ["Blocked", ip.blocked ? colorize("Yes", "red") : "No"],
    [
      "Protection",
      ip.protection.delete ? colorize("Delete protected", "yellow") : "None",
    ],
    ["Created", formatDate(ip.created)]
  );
  lines.push(table.toString());
  return lines.join("\n");
}

// Primary IPs
export function formatPrimaryIpList(ips: PrimaryIp[]): string {
  if (ips.length === 0) {
    return info("No primary IPs found.");
  }
  const table = createTable([
    "ID",
    "Name",
    "IP",
    "Type",
    "Assignee",
    "DC",
    "Auto Delete",
  ]);
  for (const ip of ips) {
    table.push([
      ip.id.toString(),
      ip.name,
      ip.ip,
      ip.type,
      ip.assignee_id?.toString() || "-",
      ip.datacenter.name,
      ip.auto_delete ? "Yes" : "No",
    ]);
  }
  return table.toString();
}

export function formatPrimaryIpDetails(ip: PrimaryIp): string {
  const lines: string[] = [];
  lines.push(heading(`Primary IP: ${ip.name}`));
  lines.push("");
  const table = createTable(["Property", "Value"]);
  table.push(
    ["ID", ip.id.toString()],
    ["Name", ip.name],
    ["IP", ip.ip],
    ["Type", ip.type],
    ["Assignee", ip.assignee_id?.toString() || "Unassigned"],
    ["Datacenter", ip.datacenter.name],
    ["Auto Delete", ip.auto_delete ? "Yes" : "No"],
    ["Blocked", ip.blocked ? colorize("Yes", "red") : "No"],
    [
      "Protection",
      ip.protection.delete ? colorize("Delete protected", "yellow") : "None",
    ],
    ["Created", formatDate(ip.created)]
  );
  lines.push(table.toString());
  return lines.join("\n");
}

// Volumes
export function formatVolumeList(volumes: Volume[]): string {
  if (volumes.length === 0) {
    return info("No volumes found.");
  }
  const table = createTable([
    "ID",
    "Name",
    "Size",
    "Server",
    "Status",
    "Location",
    "Format",
  ]);
  for (const vol of volumes) {
    table.push([
      vol.id.toString(),
      vol.name,
      `${vol.size} GB`,
      vol.server?.toString() || "-",
      formatStatus(vol.status),
      vol.location.name,
      vol.format || "-",
    ]);
  }
  return table.toString();
}

export function formatVolumeDetails(vol: Volume): string {
  const lines: string[] = [];
  lines.push(heading(`Volume: ${vol.name}`));
  lines.push("");
  const table = createTable(["Property", "Value"]);
  table.push(
    ["ID", vol.id.toString()],
    ["Name", vol.name],
    ["Size", `${vol.size} GB`],
    ["Server", vol.server?.toString() || "Unattached"],
    ["Status", formatStatus(vol.status)],
    ["Location", vol.location.name],
    ["Linux Device", vol.linux_device || "-"],
    ["Format", vol.format || "-"],
    [
      "Protection",
      vol.protection.delete ? colorize("Delete protected", "yellow") : "None",
    ],
    ["Created", formatDate(vol.created)]
  );
  lines.push(table.toString());
  return lines.join("\n");
}

// Load Balancers
export function formatLoadBalancerList(lbs: LoadBalancer[]): string {
  if (lbs.length === 0) {
    return info("No load balancers found.");
  }
  const table = createTable([
    "ID",
    "Name",
    "IPv4",
    "Type",
    "Location",
    "Targets",
    "Services",
  ]);
  for (const lb of lbs) {
    table.push([
      lb.id.toString(),
      lb.name,
      lb.public_net.ipv4.ip,
      lb.load_balancer_type.name,
      lb.location.name,
      lb.targets.length.toString(),
      lb.services.length.toString(),
    ]);
  }
  return table.toString();
}

export function formatLoadBalancerDetails(lb: LoadBalancer): string {
  const lines: string[] = [];
  lines.push(heading(`Load Balancer: ${lb.name}`));
  lines.push("");
  const table = createTable(["Property", "Value"]);
  table.push(
    ["ID", lb.id.toString()],
    ["Name", lb.name],
    ["Type", lb.load_balancer_type.name],
    ["Location", lb.location.name],
    ["IPv4", lb.public_net.ipv4.ip],
    ["IPv6", lb.public_net.ipv6.ip],
    ["Public Net", lb.public_net.enabled ? "Enabled" : "Disabled"],
    ["Algorithm", lb.algorithm.type],
    [
      "Protection",
      lb.protection.delete ? colorize("Delete protected", "yellow") : "None",
    ],
    ["Created", formatDate(lb.created)]
  );
  lines.push(table.toString());

  if (lb.services.length > 0) {
    lines.push("");
    lines.push(colorize("Services:", "bold"));
    const svcTable = createTable([
      "Protocol",
      "Listen Port",
      "Destination Port",
      "Proxyprotocol",
    ]);
    for (const svc of lb.services) {
      svcTable.push([
        svc.protocol,
        svc.listen_port.toString(),
        svc.destination_port.toString(),
        svc.proxyprotocol ? "Yes" : "No",
      ]);
    }
    lines.push(svcTable.toString());
  }
  return lines.join("\n");
}

// Images
export function formatImageList(images: Image[]): string {
  if (images.length === 0) {
    return info("No images found.");
  }
  const table = createTable([
    "ID",
    "Type",
    "Name",
    "Description",
    "OS",
    "Arch",
    "Disk",
    "Status",
  ]);
  for (const img of images) {
    table.push([
      img.id.toString(),
      img.type,
      img.name || "-",
      img.description.substring(0, 30),
      img.os_flavor,
      img.architecture,
      `${img.disk_size} GB`,
      formatStatus(img.status),
    ]);
  }
  return table.toString();
}

export function formatImageDetails(img: Image): string {
  const lines: string[] = [];
  lines.push(heading(`Image: ${img.description}`));
  lines.push("");
  const table = createTable(["Property", "Value"]);
  table.push(
    ["ID", img.id.toString()],
    ["Type", img.type],
    ["Name", img.name || "-"],
    ["Description", img.description],
    ["OS Flavor", img.os_flavor],
    ["OS Version", img.os_version || "-"],
    ["Architecture", img.architecture],
    ["Disk Size", `${img.disk_size} GB`],
    [
      "Image Size",
      img.image_size ? formatBytes(img.image_size * 1024 * 1024) : "-",
    ],
    ["Status", formatStatus(img.status)],
    ["Rapid Deploy", img.rapid_deploy ? "Yes" : "No"],
    [
      "Protection",
      img.protection.delete ? colorize("Delete protected", "yellow") : "None",
    ],
    ["Created", formatDate(img.created)]
  );
  lines.push(table.toString());
  return lines.join("\n");
}

// Cloud SSH Keys
export function formatCloudSshKeyList(keys: CloudSshKey[]): string {
  if (keys.length === 0) {
    return info("No SSH keys found.");
  }
  const table = createTable(["ID", "Name", "Fingerprint", "Created"]);
  for (const key of keys) {
    table.push([
      key.id.toString(),
      key.name,
      key.fingerprint,
      formatDate(key.created),
    ]);
  }
  return table.toString();
}

export function formatCloudSshKeyDetails(key: CloudSshKey): string {
  const lines: string[] = [];
  lines.push(heading(`SSH Key: ${key.name}`));
  lines.push("");
  const table = createTable(["Property", "Value"]);
  table.push(
    ["ID", key.id.toString()],
    ["Name", key.name],
    ["Fingerprint", key.fingerprint],
    ["Created", formatDate(key.created)]
  );
  lines.push(table.toString());
  lines.push("");
  lines.push(colorize("Public Key:", "bold"));
  lines.push(key.public_key);
  return lines.join("\n");
}

// Certificates
export function formatCertificateList(certs: Certificate[]): string {
  if (certs.length === 0) {
    return info("No certificates found.");
  }
  const table = createTable([
    "ID",
    "Name",
    "Type",
    "Domains",
    "Valid Until",
    "Created",
  ]);
  for (const cert of certs) {
    table.push([
      cert.id.toString(),
      cert.name,
      cert.type,
      cert.domain_names.join(", ").substring(0, 30),
      formatDate(cert.not_valid_after),
      formatDate(cert.created),
    ]);
  }
  return table.toString();
}

export function formatCertificateDetails(cert: Certificate): string {
  const lines: string[] = [];
  lines.push(heading(`Certificate: ${cert.name}`));
  lines.push("");
  const table = createTable(["Property", "Value"]);
  table.push(
    ["ID", cert.id.toString()],
    ["Name", cert.name],
    ["Type", cert.type],
    ["Domains", cert.domain_names.join(", ")],
    ["Fingerprint", cert.fingerprint || "-"],
    ["Valid From", formatDate(cert.not_valid_before)],
    ["Valid Until", formatDate(cert.not_valid_after)],
    ["Created", formatDate(cert.created)]
  );
  lines.push(table.toString());
  return lines.join("\n");
}

// Placement Groups
export function formatPlacementGroupList(groups: PlacementGroup[]): string {
  if (groups.length === 0) {
    return info("No placement groups found.");
  }
  const table = createTable(["ID", "Name", "Type", "Servers", "Created"]);
  for (const pg of groups) {
    table.push([
      pg.id.toString(),
      pg.name,
      pg.type,
      pg.servers.length.toString(),
      formatDate(pg.created),
    ]);
  }
  return table.toString();
}

export function formatPlacementGroupDetails(pg: PlacementGroup): string {
  const lines: string[] = [];
  lines.push(heading(`Placement Group: ${pg.name}`));
  lines.push("");
  const table = createTable(["Property", "Value"]);
  table.push(
    ["ID", pg.id.toString()],
    ["Name", pg.name],
    ["Type", pg.type],
    ["Servers", pg.servers.length > 0 ? pg.servers.join(", ") : "-"],
    ["Created", formatDate(pg.created)]
  );
  lines.push(table.toString());
  return lines.join("\n");
}
