import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { confirm, input, password as passwordPrompt } from "@inquirer/prompts";
import { config } from "dotenv";

// `quiet: true` suppresses dotenv 17's "[dotenv@…] injecting env" banner.
// See src/cli.ts for the full rationale (it breaks JSON-output consumers).
config({ quiet: true });

const CONFIG_DIR = join(homedir(), ".hctl");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const LEGACY_CONFIG_DIR = join(homedir(), ".hetzner-cli");
const LEGACY_CONFIG_FILE = join(LEGACY_CONFIG_DIR, "config.json");
const KEYCHAIN_SERVICE = "hctl";
const LEGACY_KEYCHAIN_SERVICE = "hetzner-cli";
const KEYCHAIN_ACCOUNT = "robot-api";

// Lazy-loaded keytar module (optional dependency with native bindings)
let keytarModule: typeof import("keytar") | null = null;
let keytarLoadAttempted = false;

/**
 * Try to load keytar module (may fail if native deps unavailable)
 */
async function getKeytar(): Promise<typeof import("keytar") | null> {
  if (keytarLoadAttempted) {
    return keytarModule;
  }
  keytarLoadAttempted = true;
  try {
    keytarModule = await import("keytar");
    return keytarModule;
  } catch {
    return null;
  }
}

/**
 * Check if system keychain is available
 */
export async function hasKeychainSupport(): Promise<boolean> {
  const keytar = await getKeytar();
  if (!keytar) {
    return false;
  }
  try {
    // Try a read operation to verify keychain access
    await keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get credentials from system keychain
 */
export async function getKeychainCredentials(): Promise<{
  user: string;
  password: string;
} | null> {
  const keytar = await getKeytar();
  if (!keytar) {
    return null;
  }
  try {
    const stored =
      (await keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)) ??
      (await keytar.getPassword(LEGACY_KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT));
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored) as { user?: string; password?: string };
    if (parsed.user && parsed.password) {
      return { user: parsed.user, password: parsed.password };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save credentials to system keychain
 * @returns true if saved successfully, false otherwise
 */
export async function saveToKeychain(
  user: string,
  password: string
): Promise<boolean> {
  const keytar = await getKeytar();
  if (!keytar) {
    return false;
  }
  try {
    await keytar.setPassword(
      KEYCHAIN_SERVICE,
      KEYCHAIN_ACCOUNT,
      JSON.stringify({ user, password })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear credentials from system keychain
 */
export async function clearKeychain(): Promise<void> {
  const keytar = await getKeytar();
  if (!keytar) {
    return;
  }
  try {
    await keytar.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
    await keytar.deletePassword(LEGACY_KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  } catch {
    // Ignore errors when clearing
  }
}

export type CredentialSource = "environment" | "keychain" | "file" | null;

export interface Config {
  password?: string;
  user?: string;
}

/**
 * Ensure config directory exists
 */
function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Load configuration from file
 */
export function loadConfig(): Config {
  const file = existsSync(CONFIG_FILE) ? CONFIG_FILE : LEGACY_CONFIG_FILE;
  if (!existsSync(file)) {
    return {};
  }
  try {
    const data = readFileSync(file, "utf-8");
    return JSON.parse(data) as Config;
  } catch {
    return {};
  }
}

/**
 * Save configuration to file
 */
export function saveConfig(cfg: Config): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

/**
 * Clear saved configuration from file
 */
export function clearConfigFile(): void {
  if (existsSync(CONFIG_FILE)) {
    writeFileSync(CONFIG_FILE, "{}", { mode: 0o600 });
  }
}

/**
 * Clear saved configuration from all storage locations
 */
export async function clearConfig(): Promise<void> {
  await clearKeychain();
  clearConfigFile();
}

/**
 * Get credentials from environment variables only (sync)
 */
export function getCredentialsFromEnv(): {
  user: string;
  password: string;
} | null {
  const envUser = process.env.HETZNER_ROBOT_USER;
  const envPassword = process.env.HETZNER_ROBOT_PASSWORD;
  if (envUser && envPassword) {
    return { user: envUser, password: envPassword };
  }
  return null;
}

/**
 * Get credentials from config file only (sync)
 */
export function getCredentialsFromFile(): {
  user: string;
  password: string;
} | null {
  const cfg = loadConfig();
  if (cfg.user && cfg.password) {
    return { user: cfg.user, password: cfg.password };
  }
  return null;
}

/**
 * Get credentials from environment variables, keychain, or config file
 * Priority: env vars → keychain → config file
 */
export async function getCredentials(): Promise<{
  user: string;
  password: string;
  source: CredentialSource;
} | null> {
  // First try environment variables
  const envCreds = getCredentialsFromEnv();
  if (envCreds) {
    return { ...envCreds, source: "environment" };
  }

  // Then try keychain
  const keychainCreds = await getKeychainCredentials();
  if (keychainCreds) {
    return { ...keychainCreds, source: "keychain" };
  }

  // Finally try config file
  const fileCreds = getCredentialsFromFile();
  if (fileCreds) {
    return { ...fileCreds, source: "file" };
  }

  return null;
}

/**
 * Check if credentials are configured (sync check - env and file only)
 */
export function hasCredentialsSync(): boolean {
  return getCredentialsFromEnv() !== null || getCredentialsFromFile() !== null;
}

/**
 * Check if credentials are configured (async - includes keychain)
 */
export async function hasCredentials(): Promise<boolean> {
  return (await getCredentials()) !== null;
}

/**
 * Interactive login prompt
 */
export async function promptLogin(): Promise<{
  user: string;
  password: string;
}> {
  console.log("");
  console.log("Hetzner Robot API Authentication");
  console.log("─".repeat(40));
  console.log("");
  console.log("To create Robot web service credentials:");
  console.log("  1. Open https://robot.hetzner.com");
  console.log("  2. Top-right menu: Settings > Web service settings");
  console.log('  3. Click "create access data"');
  console.log("  4. Choose a username and password");
  console.log("");
  console.log(
    "Note: Robot web service credentials are created in the Robot UI, not in the Cloud Console."
  );
  console.log("They are separate from your main Hetzner account login.");
  console.log("");

  // Check if we should offer migration from file to keychain
  const keychainAvailable = await hasKeychainSupport();
  const existingFileCreds = getCredentialsFromFile();

  if (keychainAvailable && existingFileCreds) {
    const migrate = await confirm({
      message: "Migrate existing credentials to secure keychain storage?",
      default: true,
    });

    if (migrate) {
      const saved = await saveToKeychain(
        existingFileCreds.user,
        existingFileCreds.password
      );
      if (saved) {
        clearConfigFile();
        console.log("");
        console.log("Credentials migrated to keychain.");
        return existingFileCreds;
      }
    }
  }

  const user = await input({
    message: "Web service username:",
    validate: (v) => v.length > 0 || "Username is required",
  });

  const password = await passwordPrompt({
    message: "Web service password:",
    validate: (v) => v.length > 0 || "Password is required",
  });

  // Determine storage location based on keychain availability
  const storageMessage = keychainAvailable
    ? "Save credentials to secure keychain?"
    : "Save credentials to ~/.hctl/config.json?";

  const save = await confirm({
    message: storageMessage,
    default: true,
  });

  if (save) {
    let savedToKeychain = false;
    if (keychainAvailable) {
      savedToKeychain = await saveToKeychain(user, password);
    }

    if (savedToKeychain) {
      console.log("");
      console.log("Credentials saved to keychain.");
    } else {
      // Fall back to file storage
      saveConfig({ user, password });
      console.log("");
      console.warn(
        "Warning: System keychain unavailable. Credentials stored in plaintext at ~/.hctl/config.json"
      );
      console.log("Credentials saved to config file.");
    }
  }

  return { user, password };
}

/**
 * Get credentials, prompting if necessary
 */
export async function requireCredentials(): Promise<{
  user: string;
  password: string;
}> {
  const creds = await getCredentials();
  if (creds) {
    return { user: creds.user, password: creds.password };
  }
  return promptLogin();
}
