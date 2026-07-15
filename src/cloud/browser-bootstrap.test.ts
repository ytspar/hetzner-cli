import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  browserConnectionOptions,
  normalizePermission,
  upsertEnvValue,
  writeEnvToken,
} from "./browser-bootstrap.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("browser bootstrap helpers", () => {
  describe("normalizePermission", () => {
    it("accepts supported permissions", () => {
      expect(normalizePermission("read")).toBe("read");
      expect(normalizePermission("read-write")).toBe("read-write");
    });

    it("rejects unsupported permissions", () => {
      expect(() => normalizePermission("admin")).toThrow(
        "Permission must be 'read' or 'read-write'."
      );
    });
  });

  describe("upsertEnvValue", () => {
    it("adds a token to an empty env file", () => {
      expect(upsertEnvValue("", "HETZNER_CLOUD_TOKEN", "token")).toBe(
        "HETZNER_CLOUD_TOKEN=token\n"
      );
    });

    it("updates an existing token while keeping other values", () => {
      expect(
        upsertEnvValue(
          "A=1\nHETZNER_CLOUD_TOKEN=old\nB=2\n",
          "HETZNER_CLOUD_TOKEN",
          "new"
        )
      ).toBe("A=1\nHETZNER_CLOUD_TOKEN=new\nB=2\n");
    });
  });

  it("uses browser flags that preserve the Chrome sandbox", () => {
    const options = browserConnectionOptions();

    expect(options.ignoreAllFlags).toBe(true);
    expect(options.args).not.toContain("--no-sandbox");
  });

  it("restricts an existing env file after writing the token", () => {
    const directory = mkdtempSync(join(tmpdir(), "hctl-env-"));
    temporaryDirectories.push(directory);
    const envFile = join(directory, ".env");
    writeFileSync(envFile, "OTHER=value\n");
    chmodSync(envFile, 0o644);

    writeEnvToken(envFile, "token");

    expect(readFileSync(envFile, "utf8")).toBe(
      "OTHER=value\nHETZNER_CLOUD_TOKEN=token\n"
    );
    expect(statSync(envFile).mode % 0o1000).toBe(0o600);
  });
});
