import type { Command } from "commander";
import { success } from "../../shared/formatter.js";
import { confirmAction, output } from "../../shared/helpers.js";
import { formatNetworkDetails, formatNetworkList } from "../formatter.js";
import {
  type CloudActionOptions,
  cloudAction,
  resolveIdOrName,
} from "../helpers.js";

export function registerNetworkCommands(parent: Command): void {
  const network = parent.command("network").description("Network management");

  network
    .command("list")
    .alias("ls")
    .description("List all networks")
    .option("-l, --label-selector <selector>", "Label selector")
    .action(
      cloudAction(
        async (
          client,
          options: CloudActionOptions & { labelSelector?: string }
        ) => {
          const networks = await client.listNetworks({
            label_selector: options.labelSelector,
          });
          output(networks, formatNetworkList, options);
        }
      )
    );

  network
    .command("describe <id-or-name>")
    .description("Show network details")
    .action(
      cloudAction(
        async (client, idOrName: string, options: CloudActionOptions) => {
          const id = await resolveIdOrName(idOrName, "network", (name) =>
            client.listNetworks({ name })
          );
          const net = await client.getNetwork(id);
          output(net, formatNetworkDetails, options);
        }
      )
    );

  network
    .command("create")
    .description("Create a network")
    .requiredOption("--name <name>", "Network name")
    .requiredOption("--ip-range <range>", "IP range (CIDR)")
    .action(
      cloudAction(
        async (
          client,
          options: CloudActionOptions & { name: string; ipRange: string }
        ) => {
          const { network: net } = await client.createNetwork({
            name: options.name,
            ip_range: options.ipRange,
          });
          console.log(success(`Network '${net.name}' created (ID: ${net.id})`));
        }
      )
    );

  network
    .command("delete <id-or-name>")
    .description("Delete a network")
    .option("-y, --yes", "Skip confirmation")
    .action(
      cloudAction(
        async (client, idOrName: string, options: CloudActionOptions) => {
          const id = await resolveIdOrName(idOrName, "network", (name) =>
            client.listNetworks({ name })
          );
          const net = await client.getNetwork(id);
          if (
            !(await confirmAction(
              `Delete network '${net.name}' (ID: ${id})?`,
              options
            ))
          ) {
            return;
          }
          await client.deleteNetwork(id);
          console.log(success(`Network '${net.name}' (ID: ${id}) deleted.`));
        }
      )
    );

  network
    .command("update <id-or-name>")
    .description("Update a network")
    .option("--name <name>", "New name")
    .action(
      cloudAction(
        async (
          client,
          idOrName: string,
          options: CloudActionOptions & { name?: string }
        ) => {
          const id = await resolveIdOrName(idOrName, "network", (name) =>
            client.listNetworks({ name })
          );
          await client.updateNetwork(id, { name: options.name });
          console.log(success(`Network ${id} updated.`));
        }
      )
    );

  network
    .command("add-subnet <id-or-name>")
    .description("Add subnet to network")
    .requiredOption("--ip-range <range>", "Subnet IP range")
    .requiredOption("--type <type>", "Subnet type (cloud, server, vswitch)")
    .requiredOption("--network-zone <zone>", "Network zone")
    .action(
      cloudAction(
        async (
          client,
          idOrName: string,
          options: CloudActionOptions & {
            ipRange: string;
            type: string;
            networkZone: string;
          }
        ) => {
          const id = await resolveIdOrName(idOrName, "network", (name) =>
            client.listNetworks({ name })
          );
          await client.addSubnetToNetwork(id, {
            ip_range: options.ipRange,
            type: options.type as "cloud" | "server" | "vswitch",
            network_zone: options.networkZone,
          });
          console.log(success("Subnet added."));
        }
      )
    );

  network
    .command("delete-subnet <id-or-name>")
    .description("Delete subnet from network")
    .requiredOption("--ip-range <range>", "Subnet IP range to delete")
    .action(
      cloudAction(
        async (
          client,
          idOrName: string,
          options: CloudActionOptions & { ipRange: string }
        ) => {
          const id = await resolveIdOrName(idOrName, "network", (name) =>
            client.listNetworks({ name })
          );
          await client.deleteSubnetFromNetwork(id, options.ipRange);
          console.log(success("Subnet deleted."));
        }
      )
    );

  network
    .command("add-route <id-or-name>")
    .description("Add route to network")
    .requiredOption("--destination <cidr>", "Destination CIDR")
    .requiredOption("--gateway <ip>", "Gateway IP")
    .action(
      cloudAction(
        async (
          client,
          idOrName: string,
          options: CloudActionOptions & { destination: string; gateway: string }
        ) => {
          const id = await resolveIdOrName(idOrName, "network", (name) =>
            client.listNetworks({ name })
          );
          await client.addRouteToNetwork(id, {
            destination: options.destination,
            gateway: options.gateway,
          });
          console.log(success("Route added."));
        }
      )
    );

  network
    .command("delete-route <id-or-name>")
    .description("Delete route from network")
    .requiredOption("--destination <cidr>", "Destination CIDR")
    .requiredOption("--gateway <ip>", "Gateway IP")
    .action(
      cloudAction(
        async (
          client,
          idOrName: string,
          options: CloudActionOptions & { destination: string; gateway: string }
        ) => {
          const id = await resolveIdOrName(idOrName, "network", (name) =>
            client.listNetworks({ name })
          );
          await client.deleteRouteFromNetwork(id, {
            destination: options.destination,
            gateway: options.gateway,
          });
          console.log(success("Route deleted."));
        }
      )
    );

  network
    .command("change-ip-range <id-or-name>")
    .description("Change network IP range")
    .requiredOption("--ip-range <range>", "New IP range")
    .action(
      cloudAction(
        async (
          client,
          idOrName: string,
          options: CloudActionOptions & { ipRange: string }
        ) => {
          const id = await resolveIdOrName(idOrName, "network", (name) =>
            client.listNetworks({ name })
          );
          await client.changeNetworkIpRange(id, options.ipRange);
          console.log(success("IP range changed."));
        }
      )
    );

  network
    .command("enable-protection <id-or-name>")
    .description("Enable delete protection")
    .action(
      cloudAction(async (client, idOrName: string) => {
        const id = await resolveIdOrName(idOrName, "network", (name) =>
          client.listNetworks({ name })
        );
        await client.changeNetworkProtection(id, true);
        console.log(success(`Protection enabled for network ${id}.`));
      })
    );

  network
    .command("disable-protection <id-or-name>")
    .description("Disable delete protection")
    .action(
      cloudAction(async (client, idOrName: string) => {
        const id = await resolveIdOrName(idOrName, "network", (name) =>
          client.listNetworks({ name })
        );
        await client.changeNetworkProtection(id, false);
        console.log(success(`Protection disabled for network ${id}.`));
      })
    );

  network
    .command("add-label <id-or-name> <label>")
    .description("Add a label (key=value)")
    .action(
      cloudAction(async (client, idOrName: string, label: string) => {
        const id = await resolveIdOrName(idOrName, "network", (name) =>
          client.listNetworks({ name })
        );
        const net = await client.getNetwork(id);
        const [key, value] = label.split("=");
        await client.updateNetwork(id, {
          labels: { ...net.labels, [key]: value || "" },
        });
        console.log(success(`Label '${key}' added.`));
      })
    );

  network
    .command("remove-label <id-or-name> <key>")
    .description("Remove a label")
    .action(
      cloudAction(async (client, idOrName: string, key: string) => {
        const id = await resolveIdOrName(idOrName, "network", (name) =>
          client.listNetworks({ name })
        );
        const net = await client.getNetwork(id);
        const labels = Object.fromEntries(
          Object.entries(net.labels).filter(([k]) => k !== key)
        );
        await client.updateNetwork(id, { labels });
        console.log(success(`Label '${key}' removed.`));
      })
    );
}
