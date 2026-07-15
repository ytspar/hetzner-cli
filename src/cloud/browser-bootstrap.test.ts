import { describe, expect, it } from "vitest";
import { normalizePermission, upsertEnvValue } from "./browser-bootstrap.js";

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
});
