import type { Command } from "commander";
import {
  clearConfig,
  getCredentials,
  promptLogin,
} from "../../shared/config.js";
import { info, success, warning } from "../../shared/formatter.js";
import { asyncAction } from "../../shared/helpers.js";

export function registerAuthCommands(parent: Command): void {
  const auth = parent.command("auth").description("Authentication management");

  auth
    .command("login")
    .description("Interactively configure credentials")
    .action(async () => {
      try {
        await promptLogin();
        console.log("");
        console.log(success("Authentication configured successfully."));
      } catch (error) {
        if (error instanceof Error && error.name === "ExitPromptError") {
          process.exit(0);
        }
        throw error;
      }
    });

  auth
    .command("logout")
    .description("Clear saved credentials")
    .action(async () => {
      await clearConfig();
      console.log(success("Credentials cleared."));
    });

  auth
    .command("status")
    .description("Check authentication status")
    .action(async () => {
      const creds = await getCredentials();
      if (creds) {
        console.log(success(`Authenticated as: ${creds.user}`));
        const sourceLabels: Record<string, string> = {
          environment: "environment variables",
          keychain: "keychain",
          file: "config file",
        };
        console.log(
          info(`Stored in: ${sourceLabels[creds.source ?? ""] ?? "unknown"}`)
        );
      } else {
        console.log(warning("Not authenticated. Run: hctl auth login"));
      }
    });

  auth
    .command("test")
    .description("Test API credentials")
    .action(
      asyncAction(async (client) => {
        const servers = await client.listServers();
        console.log(
          success(
            `Authenticated successfully. Found ${servers.length} server(s).`
          )
        );
      })
    );
}
