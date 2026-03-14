import type { Command } from "commander";
import { output } from "../../shared/helpers.js";
import {
  formatLoadBalancerTypeDetails,
  formatLoadBalancerTypeList,
} from "../formatter.js";
import {
  type CloudActionOptions,
  cloudAction,
  resolveIdOrName,
} from "../helpers.js";

export function registerLoadBalancerTypeCommands(parent: Command): void {
  const lbType = parent
    .command("load-balancer-type")
    .description("Load balancer type information");

  lbType
    .command("list")
    .alias("ls")
    .description("List all load balancer types")
    .action(
      cloudAction(async (client, options: CloudActionOptions) => {
        const types = await client.listLoadBalancerTypes();
        output(types, formatLoadBalancerTypeList, options);
      })
    );

  lbType
    .command("describe <id-or-name>")
    .description("Show load balancer type details")
    .action(
      cloudAction(
        async (client, idOrName: string, options: CloudActionOptions) => {
          const id = await resolveIdOrName(
            idOrName,
            "load balancer type",
            (name) => client.listLoadBalancerTypes({ name })
          );
          const type = await client.getLoadBalancerType(id);
          output(type, formatLoadBalancerTypeDetails, options);
        }
      )
    );
}
