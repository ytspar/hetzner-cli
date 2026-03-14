import type { Command } from "commander";
import { output } from "../../shared/helpers.js";
import { formatDatacenterDetails, formatDatacenterList } from "../formatter.js";
import {
  type CloudActionOptions,
  cloudAction,
  resolveIdOrName,
} from "../helpers.js";

export function registerDatacenterCommands(parent: Command): void {
  const datacenter = parent
    .command("datacenter")
    .description("Datacenter information");

  datacenter
    .command("list")
    .alias("ls")
    .description("List all datacenters")
    .action(
      cloudAction(async (client, options: CloudActionOptions) => {
        const datacenters = await client.listDatacenters();
        output(datacenters, formatDatacenterList, options);
      })
    );

  datacenter
    .command("describe <id-or-name>")
    .description("Show datacenter details")
    .action(
      cloudAction(
        async (client, idOrName: string, options: CloudActionOptions) => {
          const id = await resolveIdOrName(idOrName, "datacenter", (name) =>
            client.listDatacenters({ name })
          );
          const datacenter = await client.getDatacenter(id);
          output(datacenter, formatDatacenterDetails, options);
        }
      )
    );
}
