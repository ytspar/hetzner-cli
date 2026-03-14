import type { Command } from "commander";
import { success } from "../../shared/formatter.js";
import { confirmAction, output } from "../../shared/helpers.js";
import { formatFloatingIpDetails, formatFloatingIpList } from "../formatter.js";
import {
  type CloudActionOptions,
  cloudAction,
  resolveIdOrName,
} from "../helpers.js";

export function registerFloatingIpCommands(parent: Command): void {
  const fip = parent
    .command("floating-ip")
    .description("Floating IP management");

  fip
    .command("list")
    .alias("ls")
    .description("List all floating IPs")
    .option("-l, --label-selector <selector>", "Label selector")
    .action(
      cloudAction(
        async (
          client,
          options: CloudActionOptions & { labelSelector?: string }
        ) => {
          const ips = await client.listFloatingIps({
            label_selector: options.labelSelector,
          });
          output(ips, formatFloatingIpList, options);
        }
      )
    );

  fip
    .command("describe <id-or-name>")
    .description("Show floating IP details")
    .action(
      cloudAction(
        async (client, idOrName: string, options: CloudActionOptions) => {
          const id = await resolveIdOrName(idOrName, "floating IP", (name) =>
            client.listFloatingIps({ name })
          );
          const ip = await client.getFloatingIp(id);
          output(ip, formatFloatingIpDetails, options);
        }
      )
    );

  fip
    .command("create")
    .description("Create a floating IP")
    .requiredOption("--type <type>", "IP type (ipv4, ipv6)")
    .option("--name <name>", "Name")
    .option("--description <desc>", "Description")
    .option("--home-location <loc>", "Home location")
    .option("--server <id>", "Server to assign to")
    .action(
      cloudAction(
        async (
          client,
          options: CloudActionOptions & {
            type: string;
            name?: string;
            description?: string;
            homeLocation?: string;
            server?: string;
          }
        ) => {
          const { floating_ip: ip } = await client.createFloatingIp({
            type: options.type as "ipv4" | "ipv6",
            name: options.name,
            description: options.description,
            home_location: options.homeLocation,
            server: options.server
              ? Number.parseInt(options.server, 10)
              : undefined,
          });
          console.log(
            success(`Floating IP created (ID: ${ip.id}, IP: ${ip.ip})`)
          );
        }
      )
    );

  fip
    .command("delete <id-or-name>")
    .description("Delete a floating IP")
    .option("-y, --yes", "Skip confirmation")
    .action(
      cloudAction(
        async (client, idOrName: string, options: CloudActionOptions) => {
          const id = await resolveIdOrName(idOrName, "floating IP", (name) =>
            client.listFloatingIps({ name })
          );
          const ip = await client.getFloatingIp(id);
          if (
            !(await confirmAction(
              `Delete floating IP '${ip.name}' (ID: ${id})?`,
              options
            ))
          ) {
            return;
          }
          await client.deleteFloatingIp(id);
          console.log(success(`Floating IP '${ip.name}' (ID: ${id}) deleted.`));
        }
      )
    );

  fip
    .command("update <id-or-name>")
    .description("Update floating IP")
    .option("--name <name>", "New name")
    .option("--description <desc>", "New description")
    .action(
      cloudAction(
        async (
          client,
          idOrName: string,
          options: CloudActionOptions & { name?: string; description?: string }
        ) => {
          const id = await resolveIdOrName(idOrName, "floating IP", (name) =>
            client.listFloatingIps({ name })
          );
          await client.updateFloatingIp(id, {
            name: options.name,
            description: options.description,
          });
          console.log(success(`Floating IP ${id} updated.`));
        }
      )
    );

  fip
    .command("assign <id-or-name> <server>")
    .description("Assign floating IP to server")
    .action(
      cloudAction(async (client, idOrName: string, server: string) => {
        const id = await resolveIdOrName(idOrName, "floating IP", (name) =>
          client.listFloatingIps({ name })
        );
        await client.assignFloatingIp(id, Number.parseInt(server, 10));
        console.log(success(`Floating IP ${id} assigned to server ${server}.`));
      })
    );

  fip
    .command("unassign <id-or-name>")
    .description("Unassign floating IP")
    .action(
      cloudAction(async (client, idOrName: string) => {
        const id = await resolveIdOrName(idOrName, "floating IP", (name) =>
          client.listFloatingIps({ name })
        );
        await client.unassignFloatingIp(id);
        console.log(success(`Floating IP ${id} unassigned.`));
      })
    );

  fip
    .command("enable-protection <id-or-name>")
    .description("Enable delete protection")
    .action(
      cloudAction(async (client, idOrName: string) => {
        const id = await resolveIdOrName(idOrName, "floating IP", (name) =>
          client.listFloatingIps({ name })
        );
        await client.changeFloatingIpProtection(id, true);
        console.log(success(`Protection enabled for floating IP ${id}.`));
      })
    );

  fip
    .command("disable-protection <id-or-name>")
    .description("Disable delete protection")
    .action(
      cloudAction(async (client, idOrName: string) => {
        const id = await resolveIdOrName(idOrName, "floating IP", (name) =>
          client.listFloatingIps({ name })
        );
        await client.changeFloatingIpProtection(id, false);
        console.log(success(`Protection disabled for floating IP ${id}.`));
      })
    );

  fip
    .command("set-rdns <id-or-name>")
    .description("Set reverse DNS")
    .requiredOption("--ip <ip>", "IP address")
    .requiredOption("--dns-ptr <ptr>", "DNS pointer (empty to reset)")
    .action(
      cloudAction(
        async (
          client,
          idOrName: string,
          options: CloudActionOptions & { ip: string; dnsPtr: string }
        ) => {
          const id = await resolveIdOrName(idOrName, "floating IP", (name) =>
            client.listFloatingIps({ name })
          );
          await client.changeFloatingIpDnsPtr(
            id,
            options.ip,
            options.dnsPtr || null
          );
          console.log(success("rDNS updated."));
        }
      )
    );

  fip
    .command("add-label <id-or-name> <label>")
    .description("Add a label (key=value)")
    .action(
      cloudAction(async (client, idOrName: string, label: string) => {
        const id = await resolveIdOrName(idOrName, "floating IP", (name) =>
          client.listFloatingIps({ name })
        );
        const ip = await client.getFloatingIp(id);
        const [key, value] = label.split("=");
        await client.updateFloatingIp(id, {
          labels: { ...ip.labels, [key]: value || "" },
        });
        console.log(success(`Label '${key}' added.`));
      })
    );

  fip
    .command("remove-label <id-or-name> <key>")
    .description("Remove a label")
    .action(
      cloudAction(async (client, idOrName: string, key: string) => {
        const id = await resolveIdOrName(idOrName, "floating IP", (name) =>
          client.listFloatingIps({ name })
        );
        const ip = await client.getFloatingIp(id);
        const labels = Object.fromEntries(
          Object.entries(ip.labels).filter(([k]) => k !== key)
        );
        await client.updateFloatingIp(id, { labels });
        console.log(success(`Label '${key}' removed.`));
      })
    );
}
