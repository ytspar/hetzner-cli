import { password as passwordPrompt } from "@inquirer/prompts";
import type { Command } from "commander";
import {
  error as fmtError,
  success as fmtSuccess,
  warning as fmtWarning,
} from "../../shared/formatter.js";
import {
  createContext,
  deleteContext,
  getActiveContext,
  listContexts,
  useContext,
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
    .action(async (name: string, options: { token?: string }) => {
      try {
        let token = options.token;
        if (!token) {
          printCloudTokenInstructions();
          token = await passwordPrompt({
            message: `Paste your Cloud API token for '${name}':`,
            validate: (v) => v.length > 0 || "Token is required",
          });
        }
        await createContext(name, token);
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
    });

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
}
