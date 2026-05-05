import { confirm, input, password as passwordPrompt } from "@inquirer/prompts";
import type { Command } from "commander";
import { createContext, listContexts } from "../cloud/context.js";
import {
  HETZNER_CLOUD_CONSOLE_URL,
  printCloudTokenInstructions,
} from "../cloud/token-instructions.js";
import { hasCredentials, promptLogin } from "./config.js";
import { heading, info, success } from "./formatter.js";

const ROBOT_URL = "https://robot.hetzner.com";

function printIntro(): void {
  console.log("");
  console.log(heading("hctl setup wizard"));
  console.log("");
  console.log(
    "This wizard configures credentials for the two authenticated APIs:"
  );
  console.log("");
  console.log(`  Robot API   ${ROBOT_URL}`);
  console.log(
    "    └─ dedicated server management; uses Robot web service credentials"
  );
  console.log(`  Cloud API   ${HETZNER_CLOUD_CONSOLE_URL}`);
  console.log(
    "    └─ cloud infrastructure; uses project-scoped Cloud API tokens"
  );
  console.log("");
  console.log(
    info("Robot and Cloud credentials are created in different Hetzner UIs.")
  );
  console.log(
    info("Auction commands need no auth and are skipped by this wizard.")
  );
}

async function setupRobot(): Promise<boolean> {
  if (await hasCredentials()) {
    console.log("");
    console.log(
      success(
        "Robot API: credentials already configured — skipping. Run `hctl auth login` to replace."
      )
    );
    return false;
  }

  console.log("");
  const proceed = await confirm({
    message: "Set up Robot API credentials now?",
    default: true,
  });
  if (!proceed) {
    return false;
  }
  await promptLogin();
  return true;
}

async function setupCloud(): Promise<boolean> {
  const existing = listContexts().map((c) => c.name);
  if (existing.length > 0) {
    console.log("");
    console.log(
      success(
        `Cloud API: ${existing.length} context(s) already configured — skipping. Run \`hctl cloud context create <name>\` to add another.`
      )
    );
    return false;
  }

  console.log("");
  const proceed = await confirm({
    message: "Set up Cloud API token now?",
    default: true,
  });
  if (!proceed) {
    return false;
  }

  printCloudTokenInstructions();

  const name = await input({
    message: "Context name (e.g. 'production', 'personal'):",
    default: "default",
    validate: (v) => {
      if (v.length === 0) {
        return "Context name is required";
      }
      if (existing.includes(v)) {
        return `Context '${v}' already exists. Pick a different name.`;
      }
      return true;
    },
  });

  const token = await passwordPrompt({
    message: `Paste your Cloud API token for '${name}':`,
    validate: (v) => v.length > 0 || "Token is required",
  });

  await createContext(name, token);
  console.log("");
  console.log(success(`Context '${name}' created and activated.`));
  return true;
}

function printNextSteps(): void {
  console.log("");
  console.log(heading("Next steps"));
  console.log("");
  console.log("  hctl auth status                # verify Robot auth");
  console.log("  hctl auth test                  # test Robot API call");
  console.log("  hctl cloud context active       # show active Cloud context");
  console.log("  hctl cloud server list          # test Cloud API call");
  console.log("");
}

export function registerInitCommand(parent: Command): void {
  parent
    .command("init")
    .alias("setup")
    .description("Walk through API credential setup for Robot and Cloud APIs")
    .action(async () => {
      try {
        printIntro();
        await setupRobot();
        await setupCloud();
        console.log("");
        console.log(success("Setup complete."));
        printNextSteps();
      } catch (err) {
        if (err instanceof Error && err.name === "ExitPromptError") {
          process.exit(0);
        }
        throw err;
      }
    });
}
