import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

vi.mock("./context.js", () => ({
  resolveToken: vi.fn(),
}));

vi.mock("./client.js", () => ({
  // biome-ignore lint/complexity/useArrowFunction: must use regular function for constructor mock
  HetznerCloudClient: vi.fn(function () {
    // mock constructor
  }),
}));

vi.mock("../shared/formatter.js", () => ({
  error: vi.fn((msg: string) => `ERROR: ${msg}`),
  formatJson: vi.fn((data: unknown) => JSON.stringify(data, null, 2)),
}));

import { HetznerCloudClient } from "./client.js";
import { resolveToken } from "./context.js";
import {
  cloudAction,
  parseLabels,
  readJsonFile,
  resolveIdOrName,
} from "./helpers.js";

const mockResolveToken = vi.mocked(resolveToken);
const mockHetznerCloudClient = vi.mocked(HetznerCloudClient);

describe("helpers", () => {
  let mockExit: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("cloudAction", () => {
    it("should resolve token and create client", async () => {
      mockResolveToken.mockResolvedValue("test-token");
      const mockClient = {} as HetznerCloudClient;
      // biome-ignore lint/complexity/useArrowFunction: must use regular function for constructor mock
      mockHetznerCloudClient.mockImplementation(function () {
        return mockClient;
      } as unknown as () => HetznerCloudClient);

      const fn = vi.fn().mockResolvedValue(undefined);
      const action = cloudAction(fn);
      await action({ token: "flag-token" });

      expect(mockResolveToken).toHaveBeenCalledWith("flag-token");
      expect(mockHetznerCloudClient).toHaveBeenCalledWith("test-token");
      expect(fn).toHaveBeenCalledWith(mockClient);
    });

    it("should pass through additional arguments before options", async () => {
      mockResolveToken.mockResolvedValue("test-token");
      const mockClient = {} as HetznerCloudClient;
      // biome-ignore lint/complexity/useArrowFunction: must use regular function for constructor mock
      mockHetznerCloudClient.mockImplementation(function () {
        return mockClient;
      } as unknown as () => HetznerCloudClient);

      const fn = vi.fn().mockResolvedValue(undefined);
      const action = cloudAction<[string, number]>(fn);
      await action("arg1", 42, { token: "tok" });

      expect(fn).toHaveBeenCalledWith(mockClient, "arg1", 42);
    });

    it("should handle Error and call process.exit(1)", async () => {
      mockResolveToken.mockRejectedValue(new Error("Token not found"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

      const action = cloudAction(vi.fn());
      await action({});

      expect(consoleSpy).toHaveBeenCalledWith("ERROR: Token not found");
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("should handle ExitPromptError and exit with 0", async () => {
      mockResolveToken.mockResolvedValue("tok");
      // biome-ignore lint/complexity/useArrowFunction: must use regular function for constructor mock
      mockHetznerCloudClient.mockImplementation(function () {
        return {} as HetznerCloudClient;
      } as unknown as () => HetznerCloudClient);

      const exitErr = new Error("ExitPromptError");
      exitErr.name = "ExitPromptError";
      const action = cloudAction(vi.fn().mockRejectedValue(exitErr));
      await action({});

      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("should handle unknown error type", async () => {
      mockResolveToken.mockRejectedValue("string error");
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

      const action = cloudAction(vi.fn());
      await action({});

      expect(consoleSpy).toHaveBeenCalledWith(
        "ERROR: An unknown error occurred"
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe("parseLabels", () => {
    it("should parse comma-separated key=value pairs", () => {
      expect(parseLabels("env=prod,team=backend")).toEqual({
        env: "prod",
        team: "backend",
      });
    });

    it("should handle keys without values", () => {
      expect(parseLabels("standalone")).toEqual({ standalone: "" });
    });

    it("should skip empty segments", () => {
      expect(parseLabels("a=1,,b=2")).toEqual({ a: "1", b: "2" });
    });

    it("should handle whitespace around pairs", () => {
      expect(parseLabels(" a=1 , b=2 ")).toEqual({ a: "1", b: "2" });
    });

    it("should handle values containing equals signs", () => {
      expect(parseLabels("key=a=b")).toEqual({ key: "a=b" });
    });

    it("should return empty object for empty string", () => {
      expect(parseLabels("")).toEqual({});
    });
  });

  describe("readJsonFile", () => {
    it("should read and parse a JSON file", () => {
      const { writeFileSync, unlinkSync } = require("node:fs");
      const { join } = require("node:path");
      const { tmpdir } = require("node:os");
      const tmpFile = join(tmpdir(), `test-${Date.now()}.json`);
      writeFileSync(tmpFile, JSON.stringify({ hello: "world" }));
      try {
        const result = readJsonFile<{ hello: string }>(tmpFile);
        expect(result).toEqual({ hello: "world" });
      } finally {
        unlinkSync(tmpFile);
      }
    });
  });

  describe("resolveIdOrName", () => {
    it("should return numeric ID directly without calling resolver", async () => {
      const resolver = vi.fn();
      const result = await resolveIdOrName("12345", "server", resolver);
      expect(result).toBe(12_345);
      expect(resolver).not.toHaveBeenCalled();
    });

    it("should resolve a name to an ID when exactly one match", async () => {
      const resolver = vi
        .fn()
        .mockResolvedValue([{ id: 42, name: "my-server" }]);
      const result = await resolveIdOrName("my-server", "server", resolver);
      expect(result).toBe(42);
      expect(resolver).toHaveBeenCalledWith("my-server");
    });

    it('should throw "not found" when no matches', async () => {
      const resolver = vi.fn().mockResolvedValue([]);
      await expect(
        resolveIdOrName("missing", "server", resolver)
      ).rejects.toThrow("server 'missing' not found");
    });

    it('should throw "multiple match" when more than one match', async () => {
      const resolver = vi.fn().mockResolvedValue([
        { id: 1, name: "dup" },
        { id: 2, name: "dup" },
      ]);
      await expect(resolveIdOrName("dup", "server", resolver)).rejects.toThrow(
        "Multiple servers match 'dup' (IDs: 1, 2). Use numeric ID instead."
      );
    });

    it("should treat mixed alphanumeric input as a name", async () => {
      const resolver = vi.fn().mockResolvedValue([{ id: 99, name: "123abc" }]);
      const result = await resolveIdOrName("123abc", "server", resolver);
      expect(result).toBe(99);
      expect(resolver).toHaveBeenCalledWith("123abc");
    });

    it("should handle leading zeros as numeric ID", async () => {
      const resolver = vi.fn();
      const result = await resolveIdOrName("007", "server", resolver);
      expect(result).toBe(7);
      expect(resolver).not.toHaveBeenCalled();
    });
  });
});
