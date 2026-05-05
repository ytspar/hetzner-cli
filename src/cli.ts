#!/usr/bin/env node

import { createRequire } from "node:module";
import { Command, Option } from "commander";
import { config } from "dotenv";
import { registerAuctionCommands } from "./auction/commands.js";
import { registerCloudCommands } from "./cloud/commands/index.js";
import { registerRobotCommands } from "./robot/commands/index.js";
import { registerInitCommand } from "./shared/init.js";
import {
  generateReference,
  type ReferenceSection,
} from "./shared/reference.js";
import { outputSchemas } from "./shared/schemas.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

// `quiet: true` suppresses dotenv 17's "[dotenv@…] injecting env (0) from .env"
// banner that otherwise lands on stdout for every command. The banner breaks
// any consumer that pipes `hctl --json …` into jq, since the first line of
// stdout is no longer parseable JSON.
config({ quiet: true });

const program = new Command();

program
  .name("hctl")
  .description(
    "Unified CLI for Hetzner Robot API (dedicated servers), Cloud API, and public server auction.\n\n" +
      "  Three APIs, one tool:\n" +
      "    Robot commands   — manage dedicated servers (requires Robot web service credentials)\n" +
      '    Cloud commands   — manage cloud infrastructure under "hctl cloud ..." (requires Cloud API token)\n' +
      '    Auction commands — browse server auction under "hctl auction ..." (no auth required)\n\n' +
      '  Run "hctl reference" for a complete structured reference of all commands and options.\n' +
      '  Run "hctl <command> --help" for help on a specific command.'
  )
  .version(version)
  .option(
    "-u, --user <username>",
    "Hetzner Robot web service username (or set HETZNER_ROBOT_USER)"
  )
  .option(
    "-p, --password <password>",
    'Hetzner Robot web service password (or set HETZNER_ROBOT_PASSWORD; use "-" to read from stdin)'
  )
  .option("--json", "Output raw JSON instead of formatted tables")
  .option(
    "--output-schema",
    "Print TypeScript type for --json output and exit (no API call)"
  );

// Top-level setup wizard for first-time users
registerInitCommand(program);

// Register all robot commands directly on program (backward compat)
registerRobotCommands(program);

// Register cloud commands under 'hctl cloud ...'
registerCloudCommands(program);

// Register auction commands (public API, no auth required)
registerAuctionCommands(program);

// Built-in reference command (structured docs for LLMs and humans)
program
  .command("reference")
  .alias("ref")
  .description("Print complete CLI reference (optimized for LLM context)")
  .addOption(
    new Option("--section <section>", "Show only a specific section").choices([
      "robot",
      "cloud",
      "auction",
    ])
  )
  .action((options: { section?: ReferenceSection }) => {
    console.log(generateReference(options.section, { version }));
  });

program.hook("preAction", (thisCommand, actionCommand) => {
  if (thisCommand.opts().outputSchema) {
    const parts: string[] = [];
    let cmd: Command | null = actionCommand;
    while (cmd && cmd !== program) {
      parts.unshift(cmd.name());
      cmd = cmd.parent;
    }
    const path = parts.join(" ");
    const schema = outputSchemas[path];
    if (schema) {
      console.log(schema);
    } else {
      console.error(`No output schema for: hctl ${path}`);
      process.exit(1);
    }
    process.exit(0);
  }
});

program.parse();
