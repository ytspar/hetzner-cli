import { readFileSync } from "node:fs";
import type { Command } from "commander";
import { error, success } from "../../shared/formatter.js";
import { confirmAction, output } from "../../shared/helpers.js";
import {
  formatCloudSshKeyDetails,
  formatCloudSshKeyList,
} from "../formatter.js";
import {
  type CloudActionOptions,
  cloudAction,
  resolveIdOrName,
} from "../helpers.js";

export function registerCloudSshKeyCommands(parent: Command): void {
  const sshKey = parent.command("ssh-key").description("SSH key management");

  sshKey
    .command("list")
    .alias("ls")
    .description("List all SSH keys")
    .option("-l, --label-selector <selector>", "Label selector")
    .option("-s, --sort <field>", "Sort by field")
    .action(
      cloudAction(
        async (
          client,
          options: CloudActionOptions & {
            labelSelector?: string;
            sort?: string;
          }
        ) => {
          const keys = await client.listSshKeys({
            label_selector: options.labelSelector,
            sort: options.sort,
          });
          output(keys, formatCloudSshKeyList, options);
        }
      )
    );

  sshKey
    .command("describe <id-or-name>")
    .description("Show SSH key details")
    .action(
      cloudAction(
        async (client, idOrName: string, options: CloudActionOptions) => {
          const id = await resolveIdOrName(idOrName, "SSH key", (name) =>
            client.listSshKeys({ name })
          );
          const key = await client.getSshKey(id);
          output(key, formatCloudSshKeyDetails, options);
        }
      )
    );

  sshKey
    .command("create")
    .description("Create an SSH key")
    .requiredOption("--name <name>", "Key name")
    .option("--public-key <key>", "Public key string")
    .option("--public-key-from-file <path>", "Read public key from file")
    .action(
      cloudAction(
        async (
          client,
          options: CloudActionOptions & {
            name: string;
            publicKey?: string;
            publicKeyFromFile?: string;
          }
        ) => {
          let pubKey = options.publicKey;
          if (options.publicKeyFromFile) {
            pubKey = readFileSync(options.publicKeyFromFile, "utf-8").trim();
          }
          if (!pubKey) {
            console.error(
              error("Provide --public-key or --public-key-from-file")
            );
            process.exit(1);
          }
          const { ssh_key: key } = await client.createSshKey({
            name: options.name,
            public_key: pubKey,
          });
          console.log(success(`SSH key '${key.name}' created (ID: ${key.id})`));
        }
      )
    );

  sshKey
    .command("delete <id-or-name>")
    .description("Delete an SSH key")
    .option("-y, --yes", "Skip confirmation")
    .action(
      cloudAction(
        async (client, idOrName: string, options: CloudActionOptions) => {
          const id = await resolveIdOrName(idOrName, "SSH key", (name) =>
            client.listSshKeys({ name })
          );
          const key = await client.getSshKey(id);
          if (
            !(await confirmAction(
              `Delete SSH key '${key.name}' (ID: ${id})?`,
              options
            ))
          ) {
            return;
          }
          await client.deleteSshKey(id);
          console.log(success(`SSH key '${key.name}' (ID: ${id}) deleted.`));
        }
      )
    );

  sshKey
    .command("update <id-or-name>")
    .description("Update SSH key")
    .option("--name <name>", "New name")
    .action(
      cloudAction(
        async (
          client,
          idOrName: string,
          options: CloudActionOptions & { name?: string }
        ) => {
          const id = await resolveIdOrName(idOrName, "SSH key", (name) =>
            client.listSshKeys({ name })
          );
          await client.updateSshKey(id, { name: options.name });
          console.log(success(`SSH key ${id} updated.`));
        }
      )
    );

  sshKey
    .command("add-label <id-or-name> <label>")
    .description("Add a label (key=value)")
    .action(
      cloudAction(async (client, idOrName: string, label: string) => {
        const id = await resolveIdOrName(idOrName, "SSH key", (name) =>
          client.listSshKeys({ name })
        );
        const key = await client.getSshKey(id);
        const [k, v] = label.split("=");
        await client.updateSshKey(id, {
          labels: { ...key.labels, [k]: v || "" },
        });
        console.log(success(`Label '${k}' added.`));
      })
    );

  sshKey
    .command("remove-label <id-or-name> <key>")
    .description("Remove a label")
    .action(
      cloudAction(async (client, idOrName: string, key: string) => {
        const id = await resolveIdOrName(idOrName, "SSH key", (name) =>
          client.listSshKeys({ name })
        );
        const sshKeyData = await client.getSshKey(id);
        const labels = Object.fromEntries(
          Object.entries(sshKeyData.labels).filter(([k]) => k !== key)
        );
        await client.updateSshKey(id, { labels });
        console.log(success(`Label '${key}' removed.`));
      })
    );
}
