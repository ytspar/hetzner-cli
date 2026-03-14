import type { Command } from "commander";
import { success } from "../../shared/formatter.js";
import { confirmAction, output } from "../../shared/helpers.js";
import { formatVolumeDetails, formatVolumeList } from "../formatter.js";
import {
  type CloudActionOptions,
  cloudAction,
  resolveIdOrName,
} from "../helpers.js";

export function registerVolumeCommands(parent: Command): void {
  const volume = parent.command("volume").description("Volume management");

  volume
    .command("list")
    .alias("ls")
    .description("List all volumes")
    .option("-l, --label-selector <selector>", "Label selector")
    .option("-s, --sort <field>", "Sort by field")
    .option("--status <status>", "Filter by status")
    .action(
      cloudAction(
        async (
          client,
          options: CloudActionOptions & {
            labelSelector?: string;
            sort?: string;
            status?: string;
          }
        ) => {
          const volumes = await client.listVolumes({
            label_selector: options.labelSelector,
            sort: options.sort,
            status: options.status,
          });
          output(volumes, formatVolumeList, options);
        }
      )
    );

  volume
    .command("describe <id-or-name>")
    .description("Show volume details")
    .action(
      cloudAction(
        async (client, idOrName: string, options: CloudActionOptions) => {
          const id = await resolveIdOrName(idOrName, "volume", (name) =>
            client.listVolumes({ name })
          );
          const vol = await client.getVolume(id);
          output(vol, formatVolumeDetails, options);
        }
      )
    );

  volume
    .command("create")
    .description("Create a volume")
    .requiredOption("--name <name>", "Volume name")
    .requiredOption("--size <size>", "Size in GB")
    .option("--location <loc>", "Location")
    .option("--server <id>", "Server to attach to")
    .option("--format <format>", "Filesystem format (ext4, xfs)")
    .option("--automount", "Auto-mount on server")
    .action(
      cloudAction(
        async (
          client,
          options: CloudActionOptions & {
            name: string;
            size: string;
            location?: string;
            server?: string;
            format?: string;
            automount?: boolean;
          }
        ) => {
          const { volume: vol } = await client.createVolume({
            name: options.name,
            size: Number.parseInt(options.size, 10),
            location: options.location,
            server: options.server
              ? Number.parseInt(options.server, 10)
              : undefined,
            format: options.format,
            automount: options.automount,
          });
          console.log(
            success(
              `Volume '${vol.name}' created (ID: ${vol.id}, ${vol.size} GB)`
            )
          );
        }
      )
    );

  volume
    .command("delete <id-or-name>")
    .description("Delete a volume")
    .option("-y, --yes", "Skip confirmation")
    .action(
      cloudAction(
        async (client, idOrName: string, options: CloudActionOptions) => {
          const id = await resolveIdOrName(idOrName, "volume", (name) =>
            client.listVolumes({ name })
          );
          const vol = await client.getVolume(id);
          if (
            !(await confirmAction(
              `Delete volume '${vol.name}' (ID: ${id})?`,
              options
            ))
          ) {
            return;
          }
          await client.deleteVolume(id);
          console.log(success(`Volume '${vol.name}' (ID: ${id}) deleted.`));
        }
      )
    );

  volume
    .command("update <id-or-name>")
    .description("Update volume")
    .option("--name <name>", "New name")
    .action(
      cloudAction(
        async (
          client,
          idOrName: string,
          options: CloudActionOptions & { name?: string }
        ) => {
          const id = await resolveIdOrName(idOrName, "volume", (name) =>
            client.listVolumes({ name })
          );
          await client.updateVolume(id, { name: options.name });
          console.log(success(`Volume ${id} updated.`));
        }
      )
    );

  volume
    .command("attach <id-or-name> <server>")
    .description("Attach volume to server")
    .option("--automount", "Auto-mount on server")
    .action(
      cloudAction(
        async (
          client,
          idOrName: string,
          server: string,
          options: CloudActionOptions & { automount?: boolean }
        ) => {
          const id = await resolveIdOrName(idOrName, "volume", (name) =>
            client.listVolumes({ name })
          );
          await client.attachVolume(
            id,
            Number.parseInt(server, 10),
            options.automount
          );
          console.log(success(`Volume ${id} attached to server ${server}.`));
        }
      )
    );

  volume
    .command("detach <id-or-name>")
    .description("Detach volume from server")
    .action(
      cloudAction(async (client, idOrName: string) => {
        const id = await resolveIdOrName(idOrName, "volume", (name) =>
          client.listVolumes({ name })
        );
        await client.detachVolume(id);
        console.log(success(`Volume ${id} detached.`));
      })
    );

  volume
    .command("resize <id-or-name>")
    .description("Resize a volume")
    .requiredOption("--size <size>", "New size in GB")
    .action(
      cloudAction(
        async (
          client,
          idOrName: string,
          options: CloudActionOptions & { size: string }
        ) => {
          const id = await resolveIdOrName(idOrName, "volume", (name) =>
            client.listVolumes({ name })
          );
          await client.resizeVolume(id, Number.parseInt(options.size, 10));
          console.log(success(`Volume ${id} resized to ${options.size} GB.`));
        }
      )
    );

  volume
    .command("enable-protection <id-or-name>")
    .description("Enable delete protection")
    .action(
      cloudAction(async (client, idOrName: string) => {
        const id = await resolveIdOrName(idOrName, "volume", (name) =>
          client.listVolumes({ name })
        );
        await client.changeVolumeProtection(id, true);
        console.log(success(`Protection enabled for volume ${id}.`));
      })
    );

  volume
    .command("disable-protection <id-or-name>")
    .description("Disable delete protection")
    .action(
      cloudAction(async (client, idOrName: string) => {
        const id = await resolveIdOrName(idOrName, "volume", (name) =>
          client.listVolumes({ name })
        );
        await client.changeVolumeProtection(id, false);
        console.log(success(`Protection disabled for volume ${id}.`));
      })
    );

  volume
    .command("add-label <id-or-name> <label>")
    .description("Add a label (key=value)")
    .action(
      cloudAction(async (client, idOrName: string, label: string) => {
        const id = await resolveIdOrName(idOrName, "volume", (name) =>
          client.listVolumes({ name })
        );
        const vol = await client.getVolume(id);
        const [key, value] = label.split("=");
        await client.updateVolume(id, {
          labels: { ...vol.labels, [key]: value || "" },
        });
        console.log(success(`Label '${key}' added.`));
      })
    );

  volume
    .command("remove-label <id-or-name> <key>")
    .description("Remove a label")
    .action(
      cloudAction(async (client, idOrName: string, key: string) => {
        const id = await resolveIdOrName(idOrName, "volume", (name) =>
          client.listVolumes({ name })
        );
        const vol = await client.getVolume(id);
        const labels = Object.fromEntries(
          Object.entries(vol.labels).filter(([k]) => k !== key)
        );
        await client.updateVolume(id, { labels });
        console.log(success(`Label '${key}' removed.`));
      })
    );
}
