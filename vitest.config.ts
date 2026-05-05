import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "cloudflare/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "json"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/cli.ts",
        "src/types.ts",
        "src/index.ts",
        "src/client.ts",
        "src/config.ts",
        "src/formatter.ts",
        "src/shared/helpers.ts",
        "src/shared/init.ts",
        "src/shared/reference.ts",
        "src/robot/types.ts",
        "src/robot/commands/**",
        "src/cloud/types.ts",
        "src/cloud/commands/**",
        "src/auction/commands.ts",
        "src/auction/types.ts",
      ],
      thresholds: {
        lines: 99,
        functions: 100,
        branches: 98,
        statements: 99,
      },
    },
  },
});
