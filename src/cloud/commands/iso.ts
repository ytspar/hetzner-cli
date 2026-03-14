import type { Command } from "commander";
import { output } from "../../shared/helpers.js";
import { formatIsoDetails, formatIsoList } from "../formatter.js";
import {
  type CloudActionOptions,
  cloudAction,
  resolveIdOrName,
} from "../helpers.js";

export function registerIsoCommands(parent: Command): void {
  const iso = parent.command("iso").description("ISO image management");

  iso
    .command("list")
    .alias("ls")
    .description("List all ISOs")
    .option("-n, --name <name>", "Filter by name")
    .option("-a, --architecture <arch>", "Filter by architecture")
    .action(
      cloudAction(
        async (
          client,
          options: CloudActionOptions & { name?: string; architecture?: string }
        ) => {
          const isos = await client.listIsos({
            name: options.name,
            architecture: options.architecture,
          });
          output(isos, formatIsoList, options);
        }
      )
    );

  iso
    .command("describe <id-or-name>")
    .description("Show ISO details")
    .action(
      cloudAction(
        async (client, idOrName: string, options: CloudActionOptions) => {
          const id = await resolveIdOrName(idOrName, "ISO", (name) =>
            client.listIsos({ name })
          );
          const iso = await client.getIso(id);
          output(iso, formatIsoDetails, options);
        }
      )
    );
}
