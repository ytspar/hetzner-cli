import type { Command } from "commander";
import { output } from "../../shared/helpers.js";
import { formatInventoryReport } from "../formatter.js";
import { type CloudActionOptions, cloudAction } from "../helpers.js";
import { buildInventory } from "../inventory.js";

export function registerInventoryCommands(parent: Command): void {
  parent
    .command("inventory")
    .description(
      "Full fleet inventory with estimated monthly costs (list prices x live resources)"
    )
    .action(
      cloudAction(async (client, options: CloudActionOptions) => {
        const report = await buildInventory(client);
        output(report, formatInventoryReport, options);
      })
    );
}
