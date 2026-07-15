import { password as passwordPrompt } from "@inquirer/prompts";
import type { Command } from "commander";
import {
  error as fmtError,
  success as fmtSuccess,
  warning as fmtWarning,
} from "../../shared/formatter.js";
import {
  type CloudTokenPermission,
  normalizePermission,
  runCloudTokenBootstrap,
} from "../browser-bootstrap.js";
import {
  createContext,
  deleteContext,
  getActiveContext,
  listContexts,
  resolveToken,
  useContext,
  validateCloudToken,
} from "../context.js";
import { formatContextList } from "../formatter.js";
import { printCloudTokenInstructions } from "../token-instructions.js";

export function registerContextCommands(parent: Command): void {
  const context = parent
    .command("context")
    .description("Cloud context (token) management");

  context
    .command("create <name>")
    .description("Create a new cloud context")
    .option("-t, --token <token>", "API token (will prompt if not provided)")
    .option("--no-verify", "Skip validating the token with api.hetzner.cloud")
    .action(
      async (name: string, options: { token?: string; verify?: boolean }) => {
        try {
          let token = options.token;
          if (!token) {
            printCloudTokenInstructions();
            token = await passwordPrompt({
              message: `Paste your Cloud API token for '${name}':`,
              validate: (v) => v.length > 0 || "Token is required",
            });
          }
          await createContext(name, token, { verify: options.verify });
          console.log(fmtSuccess(`Context '${name}' created and activated.`));
        } catch (error) {
          if (error instanceof Error && error.name === "ExitPromptError") {
            process.exit(0);
          }
          console.error(
            fmtError(error instanceof Error ? error.message : "Unknown error")
          );
          process.exit(1);
        }
      }
    );

  context
    .command("use <name>")
    .description("Switch to a different cloud context")
    .action((name: string) => {
      try {
        useContext(name);
        console.log(fmtSuccess(`Switched to context '${name}'.`));
      } catch (error) {
        console.error(
          fmtError(error instanceof Error ? error.message : "Unknown error")
        );
        process.exit(1);
      }
    });

  context
    .command("delete <name>")
    .alias("rm")
    .description("Delete a cloud context")
    .action(async (name: string) => {
      try {
        await deleteContext(name);
        console.log(fmtSuccess(`Context '${name}' deleted.`));
      } catch (error) {
        console.error(
          fmtError(error instanceof Error ? error.message : "Unknown error")
        );
        process.exit(1);
      }
    });

  context
    .command("list")
    .alias("ls")
    .description("List all cloud contexts")
    .action(() => {
      const contexts = listContexts();
      console.log(formatContextList(contexts));
    });

  context
    .command("active")
    .description("Show the active cloud context")
    .action(() => {
      const active = getActiveContext();
      if (active) {
        console.log(fmtSuccess(`Active context: ${active}`));
      } else {
        console.log(
          fmtWarning("No active context. Run: hctl cloud context create")
        );
      }
    });

  context
    .command("test")
    .description("Validate the resolved Cloud API token")
    .option("-t, --token <token>", "API token to validate")
    .action(async (options: { token?: string }) => {
      try {
        const token = await resolveToken(options.token);
        await validateCloudToken(token);
        console.log(
          fmtSuccess("Cloud token is accepted by api.hetzner.cloud.")
        );
        console.log(
          fmtWarning(
            "Hetzner does not expose the project name through this API; verify the context name matches the Cloud Console project."
          )
        );
      } catch (error) {
        console.error(
          fmtError(error instanceof Error ? error.message : "Unknown error")
        );
        process.exit(1);
      }
    });

  context
    .command("bootstrap <name>")
    .description(
      "Open an explicit browser-assisted flow to create and save a Cloud API token"
    )
    .requiredOption("--project <name>", "Cloud project name")
    .option("--create-project", "Guide through creating the project first")
    .option("--token-name <name>", "API token name to use in Hetzner Console")
    .option(
      "--permission <permission>",
      "Token permission: read or read-write",
      "read-write"
    )
    .option(
      "--write-env [path]",
      "Also write HETZNER_CLOUD_TOKEN to .env or the provided env file path"
    )
    .option("--no-verify", "Skip validating the token with api.hetzner.cloud")
    .action(
      async (
        name: string,
        options: {
          createProject?: boolean;
          permission: string;
          project: string;
          tokenName?: string;
          verify?: boolean;
          writeEnv?: string | boolean;
        }
      ) => {
        try {
          const permission: CloudTokenPermission = normalizePermission(
            options.permission
          );
          const created = await runCloudTokenBootstrap({
            contextName: name,
            createProject: options.createProject,
            envFile: options.writeEnv,
            permission,
            projectName: options.project,
            tokenName: options.tokenName,
            verify: options.verify,
          });
          if (created) {
            console.log(fmtSuccess(`Context '${name}' created and activated.`));
          }
        } catch (error) {
          if (error instanceof Error && error.name === "ExitPromptError") {
            process.exit(0);
          }
          console.error(
            fmtError(error instanceof Error ? error.message : "Unknown error")
          );
          process.exit(1);
        }
      }
    );
}
