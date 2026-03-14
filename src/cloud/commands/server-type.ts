import type { Command } from "commander";
import { output } from "../../shared/helpers.js";
import { formatServerTypeDetails, formatServerTypeList } from "../formatter.js";
import {
  type CloudActionOptions,
  cloudAction,
  resolveIdOrName,
} from "../helpers.js";

export function registerServerTypeCommands(parent: Command): void {
  const serverType = parent
    .command("server-type")
    .description("Server type information");

  serverType
    .command("list")
    .alias("ls")
    .description("List all server types")
    .action(
      cloudAction(async (client, options: CloudActionOptions) => {
        const types = await client.listServerTypes();
        output(types, formatServerTypeList, options);
      })
    );

  serverType
    .command("describe <id-or-name>")
    .description("Show server type details")
    .action(
      cloudAction(
        async (client, idOrName: string, options: CloudActionOptions) => {
          const id = await resolveIdOrName(idOrName, "server type", (name) =>
            client.listServerTypes({ name })
          );
          const type = await client.getServerType(id);
          output(type, formatServerTypeDetails, options);
        }
      )
    );
}
