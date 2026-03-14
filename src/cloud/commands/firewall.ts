import type { Command } from "commander";
import { success } from "../../shared/formatter.js";
import { confirmAction, output } from "../../shared/helpers.js";
import {
  formatCloudFirewallDetails,
  formatCloudFirewallList,
} from "../formatter.js";
import {
  type CloudActionOptions,
  cloudAction,
  parseLabels,
  readJsonFile,
  resolveIdOrName,
} from "../helpers.js";
import type { CloudFirewallRule } from "../types.js";

export function registerCloudFirewallCommands(parent: Command): void {
  const firewall = parent
    .command("firewall")
    .description("Cloud firewall management");

  firewall
    .command("list")
    .alias("ls")
    .description("List all firewalls")
    .option("-l, --label-selector <selector>", "Label selector")
    .action(
      cloudAction(
        async (
          client,
          options: CloudActionOptions & { labelSelector?: string }
        ) => {
          const firewalls = await client.listFirewalls({
            label_selector: options.labelSelector,
          });
          output(firewalls, formatCloudFirewallList, options);
        }
      )
    );

  firewall
    .command("describe <id-or-name>")
    .description("Show firewall details")
    .action(
      cloudAction(
        async (client, idOrName: string, options: CloudActionOptions) => {
          const id = await resolveIdOrName(idOrName, "firewall", (name) =>
            client.listFirewalls({ name })
          );
          const fw = await client.getFirewall(id);
          output(fw, formatCloudFirewallDetails, options);
        }
      )
    );

  firewall
    .command("create")
    .description("Create a firewall")
    .requiredOption("--name <name>", "Firewall name")
    .option("--rules-file <file>", "JSON file with firewall rules array")
    .option("--labels <labels>", "Labels as key=value pairs (comma-separated)")
    .action(
      cloudAction(
        async (
          client,
          options: CloudActionOptions & {
            name: string;
            rulesFile?: string;
            labels?: string;
          }
        ) => {
          const { firewall: fw } = await client.createFirewall({
            name: options.name,
            rules: options.rulesFile
              ? readJsonFile(options.rulesFile)
              : undefined,
            labels: options.labels ? parseLabels(options.labels) : undefined,
          });
          console.log(
            success(
              `Firewall '${fw.name}' created (ID: ${fw.id}, ${fw.rules.length} rules)`
            )
          );
        }
      )
    );

  firewall
    .command("delete <id-or-name>")
    .description("Delete a firewall")
    .option("-y, --yes", "Skip confirmation")
    .action(
      cloudAction(
        async (client, idOrName: string, options: CloudActionOptions) => {
          const id = await resolveIdOrName(idOrName, "firewall", (name) =>
            client.listFirewalls({ name })
          );
          const fw = await client.getFirewall(id);
          if (
            !(await confirmAction(
              `Delete firewall '${fw.name}' (ID: ${id})?`,
              options
            ))
          ) {
            return;
          }
          await client.deleteFirewall(id);
          console.log(success(`Firewall '${fw.name}' (ID: ${id}) deleted.`));
        }
      )
    );

  firewall
    .command("update <id-or-name>")
    .description("Update firewall")
    .option("--name <name>", "New name")
    .action(
      cloudAction(
        async (
          client,
          idOrName: string,
          options: CloudActionOptions & { name?: string }
        ) => {
          const id = await resolveIdOrName(idOrName, "firewall", (name) =>
            client.listFirewalls({ name })
          );
          await client.updateFirewall(id, { name: options.name });
          console.log(success(`Firewall ${id} updated.`));
        }
      )
    );

  firewall
    .command("apply-to-resource <id-or-name>")
    .description("Apply firewall to resource")
    .requiredOption("--type <type>", "Resource type (server, label_selector)")
    .option("--server <server>", "Server ID")
    .option("--label-selector <selector>", "Label selector")
    .action(
      cloudAction(
        async (
          client,
          idOrName: string,
          options: CloudActionOptions & {
            type: string;
            server?: string;
            labelSelector?: string;
          }
        ) => {
          const id = await resolveIdOrName(idOrName, "firewall", (name) =>
            client.listFirewalls({ name })
          );
          const applyTo = [
            {
              type: options.type as "server" | "label_selector",
              ...(options.server
                ? { server: { id: Number.parseInt(options.server, 10) } }
                : {}),
              ...(options.labelSelector
                ? { label_selector: { selector: options.labelSelector } }
                : {}),
            },
          ];
          await client.applyFirewall(id, applyTo);
          console.log(success(`Firewall ${id} applied.`));
        }
      )
    );

  firewall
    .command("remove-from-resource <id-or-name>")
    .description("Remove firewall from resource")
    .requiredOption("--type <type>", "Resource type (server, label_selector)")
    .option("--server <server>", "Server ID")
    .option("--label-selector <selector>", "Label selector")
    .action(
      cloudAction(
        async (
          client,
          idOrName: string,
          options: CloudActionOptions & {
            type: string;
            server?: string;
            labelSelector?: string;
          }
        ) => {
          const id = await resolveIdOrName(idOrName, "firewall", (name) =>
            client.listFirewalls({ name })
          );
          const removeFrom = [
            {
              type: options.type as "server" | "label_selector",
              ...(options.server
                ? { server: { id: Number.parseInt(options.server, 10) } }
                : {}),
              ...(options.labelSelector
                ? { label_selector: { selector: options.labelSelector } }
                : {}),
            },
          ];
          await client.removeFirewallFromResources(id, removeFrom);
          console.log(success(`Firewall ${id} removed from resource.`));
        }
      )
    );

  firewall
    .command("add-label <id-or-name> <label>")
    .description("Add a label (key=value)")
    .action(
      cloudAction(async (client, idOrName: string, label: string) => {
        const id = await resolveIdOrName(idOrName, "firewall", (name) =>
          client.listFirewalls({ name })
        );
        const fw = await client.getFirewall(id);
        const [key, value] = label.split("=");
        await client.updateFirewall(id, {
          labels: { ...fw.labels, [key]: value || "" },
        });
        console.log(success(`Label '${key}' added.`));
      })
    );

  firewall
    .command("remove-label <id-or-name> <key>")
    .description("Remove a label")
    .action(
      cloudAction(async (client, idOrName: string, key: string) => {
        const id = await resolveIdOrName(idOrName, "firewall", (name) =>
          client.listFirewalls({ name })
        );
        const fw = await client.getFirewall(id);
        const labels = Object.fromEntries(
          Object.entries(fw.labels).filter(([k]) => k !== key)
        );
        await client.updateFirewall(id, { labels });
        console.log(success(`Label '${key}' removed.`));
      })
    );

  firewall
    .command("set-rules <id-or-name>")
    .description("Set firewall rules from a JSON file")
    .requiredOption(
      "--rules-file <file>",
      "JSON file with firewall rules array"
    )
    .action(
      cloudAction(
        async (
          client,
          idOrName: string,
          options: CloudActionOptions & { rulesFile: string }
        ) => {
          const id = await resolveIdOrName(idOrName, "firewall", (name) =>
            client.listFirewalls({ name })
          );
          const rules = readJsonFile<CloudFirewallRule[]>(options.rulesFile);
          await client.setFirewallRules(id, rules);
          console.log(success(`Firewall ${id} rules updated.`));
        }
      )
    );
}
