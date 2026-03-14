import type { Command } from "commander";
import { success } from "../../shared/formatter.js";
import { confirmAction, output } from "../../shared/helpers.js";
import { formatImageDetails, formatImageList } from "../formatter.js";
import {
  type CloudActionOptions,
  cloudAction,
  resolveIdOrName,
} from "../helpers.js";

export function registerImageCommands(parent: Command): void {
  const image = parent.command("image").description("Image management");

  image
    .command("list")
    .alias("ls")
    .description("List all images")
    .option("-l, --label-selector <selector>", "Label selector")
    .option("-s, --sort <field>", "Sort by field")
    .option("--type <type>", "Filter by type (system, snapshot, backup, app)")
    .option("--architecture <arch>", "Filter by architecture (x86, arm)")
    .option("--status <status>", "Filter by status")
    .action(
      cloudAction(
        async (
          client,
          options: CloudActionOptions & {
            labelSelector?: string;
            sort?: string;
            type?: string;
            architecture?: string;
            status?: string;
          }
        ) => {
          const images = await client.listImages({
            label_selector: options.labelSelector,
            sort: options.sort,
            type: options.type,
            architecture: options.architecture,
            status: options.status,
          });
          output(images, formatImageList, options);
        }
      )
    );

  image
    .command("describe <id-or-name>")
    .description("Show image details")
    .action(
      cloudAction(
        async (client, idOrName: string, options: CloudActionOptions) => {
          const id = await resolveIdOrName(idOrName, "image", (name) =>
            client.listImages({ name })
          );
          const img = await client.getImage(id);
          output(img, formatImageDetails, options);
        }
      )
    );

  image
    .command("update <id-or-name>")
    .description("Update image")
    .option("--description <desc>", "New description")
    .option("--type <type>", "New type (snapshot)")
    .action(
      cloudAction(
        async (
          client,
          idOrName: string,
          options: CloudActionOptions & { description?: string; type?: string }
        ) => {
          const id = await resolveIdOrName(idOrName, "image", (name) =>
            client.listImages({ name })
          );
          await client.updateImage(id, {
            description: options.description,
            type: options.type,
          });
          console.log(success(`Image ${id} updated.`));
        }
      )
    );

  image
    .command("delete <id-or-name>")
    .description("Delete an image")
    .option("-y, --yes", "Skip confirmation")
    .action(
      cloudAction(
        async (client, idOrName: string, options: CloudActionOptions) => {
          const id = await resolveIdOrName(idOrName, "image", (name) =>
            client.listImages({ name })
          );
          const img = await client.getImage(id);
          if (
            !(await confirmAction(
              `Delete image '${img.description}' (ID: ${id})?`,
              options
            ))
          ) {
            return;
          }
          await client.deleteImage(id);
          console.log(
            success(`Image '${img.description}' (ID: ${id}) deleted.`)
          );
        }
      )
    );

  image
    .command("enable-protection <id-or-name>")
    .description("Enable delete protection")
    .action(
      cloudAction(async (client, idOrName: string) => {
        const id = await resolveIdOrName(idOrName, "image", (name) =>
          client.listImages({ name })
        );
        await client.changeImageProtection(id, true);
        console.log(success(`Protection enabled for image ${id}.`));
      })
    );

  image
    .command("disable-protection <id-or-name>")
    .description("Disable delete protection")
    .action(
      cloudAction(async (client, idOrName: string) => {
        const id = await resolveIdOrName(idOrName, "image", (name) =>
          client.listImages({ name })
        );
        await client.changeImageProtection(id, false);
        console.log(success(`Protection disabled for image ${id}.`));
      })
    );

  image
    .command("add-label <id-or-name> <label>")
    .description("Add a label (key=value)")
    .action(
      cloudAction(async (client, idOrName: string, label: string) => {
        const id = await resolveIdOrName(idOrName, "image", (name) =>
          client.listImages({ name })
        );
        const img = await client.getImage(id);
        const [key, value] = label.split("=");
        await client.updateImage(id, {
          labels: { ...img.labels, [key]: value || "" },
        });
        console.log(success(`Label '${key}' added.`));
      })
    );

  image
    .command("remove-label <id-or-name> <key>")
    .description("Remove a label")
    .action(
      cloudAction(async (client, idOrName: string, key: string) => {
        const id = await resolveIdOrName(idOrName, "image", (name) =>
          client.listImages({ name })
        );
        const img = await client.getImage(id);
        const labels = Object.fromEntries(
          Object.entries(img.labels).filter(([k]) => k !== key)
        );
        await client.updateImage(id, { labels });
        console.log(success(`Label '${key}' removed.`));
      })
    );
}
