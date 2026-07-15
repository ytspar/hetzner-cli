import { heading } from "../shared/formatter.js";

export const HETZNER_CLOUD_CONSOLE_URL = "https://console.hetzner.cloud";

export function printCloudTokenInstructions(): void {
  console.log("");
  console.log(heading("Hetzner Cloud API Token"));
  console.log("");
  console.log("To create a Cloud API token:");
  console.log(`  1. Open ${HETZNER_CLOUD_CONSOLE_URL}`);
  console.log("  2. Select your project (or create one)");
  console.log("  3. Left menu: Security");
  console.log("  4. Top menu: API Tokens");
  console.log('  5. Click "Generate API Token"');
  console.log('  6. Name the token, for example "hctl"');
  console.log(
    '  7. Choose "Read & Write" for full hctl management, or "Read" for list/describe only'
  );
  console.log("  8. Copy the token now; Hetzner only shows it once.");
  console.log("");
  console.log("Note: Tokens are scoped per project (one token per project).");
  console.log(
    "This is separate from Robot web service credentials at https://robot.hetzner.com."
  );
  console.log(
    "hctl verifies Cloud tokens with api.hetzner.cloud before saving them; use --no-verify only when offline."
  );
  console.log("");
}
