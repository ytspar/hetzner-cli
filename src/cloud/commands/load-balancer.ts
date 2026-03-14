import type { Command } from "commander";
import { success } from "../../shared/formatter.js";
import { confirmAction, output } from "../../shared/helpers.js";
import type { HetznerCloudClient } from "../client.js";
import {
  formatLoadBalancerDetails,
  formatLoadBalancerList,
} from "../formatter.js";
import {
  type CloudActionOptions,
  cloudAction,
  resolveIdOrName,
} from "../helpers.js";

function resolveLbId(client: HetznerCloudClient, idOrName: string) {
  return resolveIdOrName(idOrName, "load balancer", (name) =>
    client.listLoadBalancers({ name })
  );
}

async function handleLbList(
  client: HetznerCloudClient,
  options: CloudActionOptions & {
    labelSelector?: string;
    sort?: string;
  }
) {
  const lbs = await client.listLoadBalancers({
    label_selector: options.labelSelector,
    sort: options.sort,
  });
  output(lbs, formatLoadBalancerList, options);
}

async function handleLbDescribe(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions
) {
  const id = await resolveLbId(client, idOrName);
  const loadBalancer = await client.getLoadBalancer(id);
  output(loadBalancer, formatLoadBalancerDetails, options);
}

async function handleLbCreate(
  client: HetznerCloudClient,
  options: CloudActionOptions & {
    name: string;
    type: string;
    location?: string;
    networkZone?: string;
    algorithm?: string;
  }
) {
  const { load_balancer: created } = await client.createLoadBalancer({
    name: options.name,
    load_balancer_type: options.type,
    location: options.location,
    network_zone: options.networkZone,
    algorithm: options.algorithm ? { type: options.algorithm } : undefined,
  });
  console.log(
    success(`Load balancer '${created.name}' created (ID: ${created.id})`)
  );
}

async function handleLbDelete(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions
) {
  const id = await resolveLbId(client, idOrName);
  const loadBalancer = await client.getLoadBalancer(id);
  if (
    !(await confirmAction(
      `Delete load balancer '${loadBalancer.name}' (ID: ${id})?`,
      options
    ))
  ) {
    return;
  }
  await client.deleteLoadBalancer(id);
  console.log(
    success(`Load balancer '${loadBalancer.name}' (ID: ${id}) deleted.`)
  );
}

async function handleLbUpdate(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions & { name?: string }
) {
  const id = await resolveLbId(client, idOrName);
  await client.updateLoadBalancer(id, { name: options.name });
  console.log(success(`Load balancer ${id} updated.`));
}

async function handleLbAddTarget(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions & {
    type: string;
    server?: string;
    labelSelector?: string;
    ip?: string;
    usePrivateIp?: boolean;
  }
) {
  const id = await resolveLbId(client, idOrName);
  const target: Record<string, unknown> = {
    type: options.type,
    use_private_ip: !!options.usePrivateIp,
  };
  if (options.server) {
    target.server = { id: Number.parseInt(options.server, 10) };
  }
  if (options.labelSelector) {
    target.label_selector = { selector: options.labelSelector };
  }
  if (options.ip) {
    target.ip = { ip: options.ip };
  }
  await client.addTargetToLoadBalancer(id, target);
  console.log(success(`Target added to load balancer ${id}.`));
}

async function handleLbRemoveTarget(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions & {
    type: string;
    server?: string;
    labelSelector?: string;
    ip?: string;
  }
) {
  const id = await resolveLbId(client, idOrName);
  const target: Record<string, unknown> = { type: options.type };
  if (options.server) {
    target.server = { id: Number.parseInt(options.server, 10) };
  }
  if (options.labelSelector) {
    target.label_selector = { selector: options.labelSelector };
  }
  if (options.ip) {
    target.ip = { ip: options.ip };
  }
  await client.removeTargetFromLoadBalancer(id, target);
  console.log(success(`Target removed from load balancer ${id}.`));
}

async function handleLbAddService(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions & {
    protocol: string;
    listenPort: string;
    destinationPort: string;
    proxyprotocol?: boolean;
  }
) {
  const id = await resolveLbId(client, idOrName);
  await client.addServiceToLoadBalancer(id, {
    protocol: options.protocol,
    listen_port: Number.parseInt(options.listenPort, 10),
    destination_port: Number.parseInt(options.destinationPort, 10),
    proxyprotocol: !!options.proxyprotocol,
    health_check: {
      protocol: options.protocol,
      port: Number.parseInt(options.destinationPort, 10),
      interval: 15,
      timeout: 10,
      retries: 3,
    },
  });
  console.log(success(`Service added to load balancer ${id}.`));
}

async function handleLbUpdateService(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions & {
    listenPort: string;
    protocol?: string;
    destinationPort?: string;
    proxyprotocol?: string;
  }
) {
  const id = await resolveLbId(client, idOrName);
  const service: Record<string, unknown> = {
    listen_port: Number.parseInt(options.listenPort, 10),
  };
  if (options.protocol) {
    service.protocol = options.protocol;
  }
  if (options.destinationPort) {
    service.destination_port = Number.parseInt(options.destinationPort, 10);
  }
  if (options.proxyprotocol !== undefined) {
    service.proxyprotocol = options.proxyprotocol === "true";
  }
  await client.updateServiceOnLoadBalancer(id, service);
  console.log(success(`Service on load balancer ${id} updated.`));
}

async function handleLbDeleteService(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions & { listenPort: string }
) {
  const id = await resolveLbId(client, idOrName);
  await client.deleteServiceFromLoadBalancer(
    id,
    Number.parseInt(options.listenPort, 10)
  );
  console.log(
    success(
      `Service on port ${options.listenPort} deleted from load balancer ${id}.`
    )
  );
}

async function handleLbChangeAlgorithm(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions & { algorithm: string }
) {
  const id = await resolveLbId(client, idOrName);
  await client.changeLoadBalancerAlgorithm(id, options.algorithm);
  console.log(success(`Algorithm changed for load balancer ${id}.`));
}

async function handleLbChangeType(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions & { type: string }
) {
  const id = await resolveLbId(client, idOrName);
  await client.changeLoadBalancerType(id, options.type);
  console.log(success(`Type changed for load balancer ${id}.`));
}

async function handleLbAttachToNetwork(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions & { network: string; ip?: string }
) {
  const id = await resolveLbId(client, idOrName);
  await client.attachLoadBalancerToNetwork(
    id,
    Number.parseInt(options.network, 10),
    options.ip
  );
  console.log(
    success(`Load balancer ${id} attached to network ${options.network}.`)
  );
}

async function handleLbDetachFromNetwork(
  client: HetznerCloudClient,
  idOrName: string,
  options: CloudActionOptions & { network: string }
) {
  const id = await resolveLbId(client, idOrName);
  await client.detachLoadBalancerFromNetwork(
    id,
    Number.parseInt(options.network, 10)
  );
  console.log(
    success(`Load balancer ${id} detached from network ${options.network}.`)
  );
}

async function handleLbEnablePublicInterface(
  client: HetznerCloudClient,
  idOrName: string
) {
  const id = await resolveLbId(client, idOrName);
  await client.enableLoadBalancerPublicInterface(id);
  console.log(success(`Public interface enabled for load balancer ${id}.`));
}

async function handleLbDisablePublicInterface(
  client: HetznerCloudClient,
  idOrName: string
) {
  const id = await resolveLbId(client, idOrName);
  await client.disableLoadBalancerPublicInterface(id);
  console.log(success(`Public interface disabled for load balancer ${id}.`));
}

async function handleLbEnableProtection(
  client: HetznerCloudClient,
  idOrName: string
) {
  const id = await resolveLbId(client, idOrName);
  await client.changeLoadBalancerProtection(id, true);
  console.log(success(`Protection enabled for load balancer ${id}.`));
}

async function handleLbDisableProtection(
  client: HetznerCloudClient,
  idOrName: string
) {
  const id = await resolveLbId(client, idOrName);
  await client.changeLoadBalancerProtection(id, false);
  console.log(success(`Protection disabled for load balancer ${id}.`));
}

async function handleLbAddLabel(
  client: HetznerCloudClient,
  idOrName: string,
  label: string
) {
  const id = await resolveLbId(client, idOrName);
  const loadBalancer = await client.getLoadBalancer(id);
  const [key, value] = label.split("=");
  await client.updateLoadBalancer(id, {
    labels: { ...loadBalancer.labels, [key]: value || "" },
  });
  console.log(success(`Label '${key}' added.`));
}

async function handleLbRemoveLabel(
  client: HetznerCloudClient,
  idOrName: string,
  key: string
) {
  const id = await resolveLbId(client, idOrName);
  const loadBalancer = await client.getLoadBalancer(id);
  const labels = Object.fromEntries(
    Object.entries(loadBalancer.labels).filter(([k]) => k !== key)
  );
  await client.updateLoadBalancer(id, { labels });
  console.log(success(`Label '${key}' removed.`));
}

export function registerLoadBalancerCommands(parent: Command): void {
  const lb = parent
    .command("load-balancer")
    .description("Load balancer management");

  lb.command("list")
    .alias("ls")
    .description("List all load balancers")
    .option("-l, --label-selector <selector>", "Label selector")
    .option("-s, --sort <field>", "Sort by field")
    .action(cloudAction(handleLbList));

  lb.command("describe <id-or-name>")
    .description("Show load balancer details")
    .action(cloudAction(handleLbDescribe));

  lb.command("create")
    .description("Create a load balancer")
    .requiredOption("--name <name>", "Load balancer name")
    .requiredOption("--type <type>", "Load balancer type")
    .option("--location <loc>", "Location")
    .option("--network-zone <zone>", "Network zone")
    .option(
      "--algorithm <algo>",
      "Algorithm (round_robin, least_connections)",
      "round_robin"
    )
    .action(cloudAction(handleLbCreate));

  lb.command("delete <id-or-name>")
    .description("Delete a load balancer")
    .option("-y, --yes", "Skip confirmation")
    .action(cloudAction(handleLbDelete));

  lb.command("update <id-or-name>")
    .description("Update load balancer")
    .option("--name <name>", "New name")
    .action(cloudAction(handleLbUpdate));

  lb.command("add-target <id-or-name>")
    .description("Add target to load balancer")
    .requiredOption("--type <type>", "Target type (server, label_selector, ip)")
    .option("--server <server>", "Server ID")
    .option("--label-selector <selector>", "Label selector")
    .option("--ip <ip>", "IP address")
    .option("--use-private-ip", "Use private IP")
    .action(cloudAction(handleLbAddTarget));

  lb.command("remove-target <id-or-name>")
    .description("Remove target from load balancer")
    .requiredOption("--type <type>", "Target type (server, label_selector, ip)")
    .option("--server <server>", "Server ID")
    .option("--label-selector <selector>", "Label selector")
    .option("--ip <ip>", "IP address")
    .action(cloudAction(handleLbRemoveTarget));

  lb.command("add-service <id-or-name>")
    .description("Add service to load balancer")
    .requiredOption("--protocol <protocol>", "Protocol (tcp, http, https)")
    .requiredOption("--listen-port <port>", "Listen port")
    .requiredOption("--destination-port <port>", "Destination port")
    .option("--proxyprotocol", "Enable proxy protocol")
    .action(cloudAction(handleLbAddService));

  lb.command("update-service <id-or-name>")
    .description("Update a service on load balancer")
    .requiredOption(
      "--listen-port <port>",
      "Listen port of the service to update"
    )
    .option("--protocol <protocol>", "New protocol")
    .option("--destination-port <port>", "New destination port")
    .option(
      "--proxyprotocol <bool>",
      "Enable/disable proxy protocol (true/false)"
    )
    .action(cloudAction(handleLbUpdateService));

  lb.command("delete-service <id-or-name>")
    .description("Delete a service from load balancer")
    .requiredOption(
      "--listen-port <port>",
      "Listen port of the service to delete"
    )
    .action(cloudAction(handleLbDeleteService));

  lb.command("change-algorithm <id-or-name>")
    .description("Change load balancer algorithm")
    .requiredOption(
      "--algorithm <type>",
      "Algorithm type (round_robin, least_connections)"
    )
    .action(cloudAction(handleLbChangeAlgorithm));

  lb.command("change-type <id-or-name>")
    .description("Change load balancer type")
    .requiredOption("--type <type>", "New load balancer type")
    .action(cloudAction(handleLbChangeType));

  lb.command("attach-to-network <id-or-name>")
    .description("Attach load balancer to network")
    .requiredOption("--network <network>", "Network ID")
    .option("--ip <ip>", "IP address in network")
    .action(cloudAction(handleLbAttachToNetwork));

  lb.command("detach-from-network <id-or-name>")
    .description("Detach load balancer from network")
    .requiredOption("--network <network>", "Network ID")
    .action(cloudAction(handleLbDetachFromNetwork));

  lb.command("enable-public-interface <id-or-name>")
    .description("Enable public interface")
    .action(cloudAction(handleLbEnablePublicInterface));

  lb.command("disable-public-interface <id-or-name>")
    .description("Disable public interface")
    .action(cloudAction(handleLbDisablePublicInterface));

  lb.command("enable-protection <id-or-name>")
    .description("Enable delete protection")
    .action(cloudAction(handleLbEnableProtection));

  lb.command("disable-protection <id-or-name>")
    .description("Disable delete protection")
    .action(cloudAction(handleLbDisableProtection));

  lb.command("add-label <id-or-name> <label>")
    .description("Add a label (key=value)")
    .action(cloudAction(handleLbAddLabel));

  lb.command("remove-label <id-or-name> <key>")
    .description("Remove a label")
    .action(cloudAction(handleLbRemoveLabel));
}
