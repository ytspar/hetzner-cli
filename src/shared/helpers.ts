import { readFileSync } from "node:fs";
import { confirm } from "@inquirer/prompts";

import { HetznerRobotClient } from "../robot/client.js";
import { requireCredentials } from "./config.js";
import { error as fmtError, formatJson } from "./formatter.js";

export interface ActionOptions {
  json?: boolean;
  password?: string;
  user?: string;
  yes?: boolean;
}

/**
 * Handle errors from action wrappers consistently.
 * Exits with code 0 for user-initiated prompt exits, code 1 for all other errors.
 */
export function handleActionError(err: unknown): never {
  if (err instanceof Error) {
    if (
      err.message.includes("ExitPromptError") ||
      err.name === "ExitPromptError"
    ) {
      process.exit(0);
    }
    console.error(fmtError(err.message));
  } else {
    console.error(fmtError("An unknown error occurred"));
  }
  process.exit(1);
}

export function asyncAction<T extends unknown[]>(
  fn: (client: HetznerRobotClient, ...args: T) => Promise<void>
): (...args: [...T, ActionOptions]) => Promise<void> {
  return async (...args) => {
    const options = args.at(-1) as ActionOptions;
    try {
      const { user } = options;
      let password = options.password;

      if (password === "-") {
        try {
          password = readFileSync(0, "utf-8").trim();
        } catch {
          throw new Error("Failed to read password from stdin");
        }
      }

      let apiClient: HetznerRobotClient;
      if (user && password) {
        apiClient = new HetznerRobotClient(user, password);
      } else {
        const creds = await requireCredentials();
        apiClient = new HetznerRobotClient(creds.user, creds.password);
      }

      await fn(apiClient, ...(args.slice(0, -1) as unknown as T));
    } catch (error) {
      handleActionError(error);
    }
  };
}

/**
 * Output data as JSON or formatted table based on options.
 */
export function output<T>(
  data: T,
  formatter: (data: T) => string,
  options: { json?: boolean }
): void {
  console.log(options.json ? formatJson(data) : formatter(data));
}

/**
 * Confirm destructive action unless --yes flag is set.
 * Returns true if confirmed, false if aborted.
 */
export async function confirmAction(
  message: string,
  options: { yes?: boolean },
  defaultValue = false
): Promise<boolean> {
  if (options.yes) {
    return true;
  }
  const confirmed = await confirm({ message, default: defaultValue });
  if (!confirmed) {
    console.log("Aborted.");
    return false;
  }
  return true;
}
