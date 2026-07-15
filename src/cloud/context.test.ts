import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock modules before imports
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/home/testuser"),
}));

vi.mock("keytar", () => ({
  getPassword: vi.fn(),
  setPassword: vi.fn(),
  deletePassword: vi.fn(),
}));

// biome-ignore lint/performance/noNamespaceImport: needed for vi.mocked() on namespace
import * as keytar from "keytar";
import {
  createContext,
  deleteContext,
  getActiveContext,
  listContexts,
  resolveToken,
  useContext,
  validateCloudToken,
} from "./context.js";

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockKeytarSetPassword = vi.mocked(keytar.setPassword);
const mockKeytarGetPassword = vi.mocked(keytar.getPassword);
const mockKeytarDeletePassword = vi.mocked(keytar.deletePassword);

const CONFIG_DIR = "/home/testuser/.hctl";
const CONTEXTS_FILE = "/home/testuser/.hctl/cloud-contexts.json";

function mockLoadContexts(data: {
  active: string | null;
  contexts: Record<string, { name: string; token?: string }>;
}) {
  mockExistsSync.mockImplementation(
    (p) => String(p) === CONTEXTS_FILE || String(p) === CONFIG_DIR
  );
  mockReadFileSync.mockReturnValue(JSON.stringify(data));
}

function mockEmptyContexts() {
  mockExistsSync.mockReturnValue(false);
}

describe("Cloud Context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    process.env.HETZNER_CLOUD_TOKEN = "";
  });

  describe("createContext", () => {
    it("should store token in keytar and save config", async () => {
      mockEmptyContexts();
      mockKeytarSetPassword.mockResolvedValue(undefined);

      await createContext("prod", "my-token", { verify: false });

      expect(mockKeytarSetPassword).toHaveBeenCalledWith(
        "hctl",
        "cloud-token:prod",
        "my-token"
      );
      expect(mockWriteFileSync).toHaveBeenCalled();
      const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(written.contexts.prod.name).toBe("prod");
      expect(written.contexts.prod.token).toBeUndefined();
    });

    it("should fall back to file storage when keytar fails", async () => {
      mockEmptyContexts();
      mockKeytarSetPassword.mockRejectedValue(new Error("keytar error"));

      await createContext("prod", "my-token", { verify: false });

      const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(written.contexts.prod.token).toBe("my-token");
    });

    it("should auto-activate the first context", async () => {
      mockEmptyContexts();
      mockKeytarSetPassword.mockResolvedValue(undefined);

      await createContext("first", "tok", { verify: false });

      const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(written.active).toBe("first");
    });

    it("should not change active when adding subsequent contexts", async () => {
      mockLoadContexts({
        active: "existing",
        contexts: { existing: { name: "existing" } },
      });
      mockKeytarSetPassword.mockResolvedValue(undefined);

      await createContext("second", "tok", { verify: false });

      const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(written.active).toBe("existing");
    });

    it("should create config dir if it does not exist", async () => {
      mockExistsSync.mockReturnValue(false);
      mockKeytarSetPassword.mockResolvedValue(undefined);

      await createContext("test", "tok", { verify: false });

      expect(mockMkdirSync).toHaveBeenCalledWith(CONFIG_DIR, {
        recursive: true,
        mode: 0o700,
      });
    });
  });

  describe("useContext", () => {
    it("should set the active context", () => {
      mockLoadContexts({
        active: "old",
        contexts: { old: { name: "old" }, target: { name: "target" } },
      });

      useContext("target");

      const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(written.active).toBe("target");
    });

    it("should throw for non-existent context", () => {
      mockLoadContexts({
        active: null,
        contexts: {},
      });

      expect(() => useContext("nonexistent")).toThrow(
        "Context 'nonexistent' not found"
      );
    });
  });

  describe("deleteContext", () => {
    it("should remove context and delete keytar entry", async () => {
      mockLoadContexts({
        active: "other",
        contexts: { prod: { name: "prod" }, other: { name: "other" } },
      });
      mockKeytarDeletePassword.mockResolvedValue(true);

      await deleteContext("prod");

      expect(mockKeytarDeletePassword).toHaveBeenCalledWith(
        "hctl",
        "cloud-token:prod"
      );
      const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(written.contexts.prod).toBeUndefined();
      expect(written.contexts.other).toBeDefined();
    });

    it("should auto-switch active when deleting active context", async () => {
      mockLoadContexts({
        active: "prod",
        contexts: { prod: { name: "prod" }, staging: { name: "staging" } },
      });
      mockKeytarDeletePassword.mockResolvedValue(true);

      await deleteContext("prod");

      const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(written.active).toBe("staging");
    });

    it("should set active to null when deleting the last context", async () => {
      mockLoadContexts({
        active: "only",
        contexts: { only: { name: "only" } },
      });
      mockKeytarDeletePassword.mockResolvedValue(true);

      await deleteContext("only");

      const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(written.active).toBeNull();
      expect(Object.keys(written.contexts)).toHaveLength(0);
    });

    it("should throw for non-existent context", async () => {
      mockLoadContexts({
        active: null,
        contexts: {},
      });

      await expect(deleteContext("ghost")).rejects.toThrow(
        "Context 'ghost' not found"
      );
    });

    it("should handle keytar deletion failure gracefully", async () => {
      mockLoadContexts({
        active: null,
        contexts: { ctx: { name: "ctx" } },
      });
      mockKeytarDeletePassword.mockRejectedValue(new Error("keytar fail"));

      await deleteContext("ctx");

      const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(written.contexts.ctx).toBeUndefined();
    });
  });

  describe("listContexts", () => {
    it("should return empty list when no contexts", () => {
      mockEmptyContexts();

      const result = listContexts();
      expect(result).toEqual([]);
    });

    it("should return contexts with active flag", () => {
      mockLoadContexts({
        active: "prod",
        contexts: {
          prod: { name: "prod" },
          staging: { name: "staging" },
        },
      });

      const result = listContexts();
      expect(result).toEqual([
        { name: "prod", active: true },
        { name: "staging", active: false },
      ]);
    });
  });

  describe("getActiveContext", () => {
    it("should return null when no contexts", () => {
      mockEmptyContexts();

      expect(getActiveContext()).toBeNull();
    });

    it("should return active context name", () => {
      mockLoadContexts({
        active: "prod",
        contexts: { prod: { name: "prod" } },
      });

      expect(getActiveContext()).toBe("prod");
    });
  });

  describe("loadContexts error handling", () => {
    it("should return default config when JSON parse fails", () => {
      mockExistsSync.mockImplementation(
        (p) => String(p) === CONTEXTS_FILE || String(p) === CONFIG_DIR
      );
      mockReadFileSync.mockReturnValue("not valid json {{{");

      const result = listContexts();
      expect(result).toEqual([]);
    });
  });

  describe("resolveToken", () => {
    it("should prefer flag token over everything", async () => {
      process.env.HETZNER_CLOUD_TOKEN = "env-token";
      mockLoadContexts({
        active: "ctx",
        contexts: { ctx: { name: "ctx", token: "file-token" } },
      });

      const result = await resolveToken("flag-token");
      expect(result).toBe("flag-token");
    });

    it("should use env variable when no flag", async () => {
      process.env.HETZNER_CLOUD_TOKEN = "env-token";

      const result = await resolveToken();
      expect(result).toBe("env-token");
    });

    it("should use context token from keytar when no flag or env", async () => {
      mockLoadContexts({
        active: "prod",
        contexts: { prod: { name: "prod" } },
      });
      mockKeytarGetPassword.mockResolvedValue("keytar-token");

      const result = await resolveToken();
      expect(result).toBe("keytar-token");
    });

    it("should fall back to file token when keytar returns null", async () => {
      mockLoadContexts({
        active: "prod",
        contexts: { prod: { name: "prod", token: "file-token" } },
      });
      mockKeytarGetPassword.mockResolvedValue(null);

      const result = await resolveToken();
      expect(result).toBe("file-token");
    });

    it("should throw detailed error when no token is available", async () => {
      mockEmptyContexts();

      await expect(resolveToken()).rejects.toThrow("No cloud token found");
    });

    it("should throw when active context has no token", async () => {
      mockLoadContexts({
        active: "prod",
        contexts: { prod: { name: "prod" } },
      });
      mockKeytarGetPassword.mockResolvedValue(null);

      await expect(resolveToken()).rejects.toThrow("No cloud token found");
    });

    it("should throw when no active context is set", async () => {
      mockLoadContexts({
        active: null,
        contexts: { prod: { name: "prod" } },
      });

      await expect(resolveToken()).rejects.toThrow("No cloud token found");
    });
  });

  describe("validateCloudToken", () => {
    it("should accept a token that can read Cloud API resources", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            locations: [],
            meta: { pagination: { next_page: null } },
          }),
        })
      );

      await expect(validateCloudToken("cloud-token")).resolves.toBeUndefined();
    });

    it("should reject an empty token before making an API request", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await expect(validateCloudToken("   ")).rejects.toThrow(
        "Cloud token is empty"
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should explain when the token is not accepted by Hetzner Cloud", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          json: async () => ({
            error: { code: "unauthorized", message: "Unauthorized" },
          }),
        })
      );

      await expect(validateCloudToken("wrong-token")).rejects.toThrow(
        "Robot credentials, console logins, Cloudflare tokens, DNS tokens, and R2 tokens will not work"
      );
    });
  });
});
