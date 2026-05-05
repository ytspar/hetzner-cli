import { createRequire } from "node:module";
import { defineConfig, type Plugin } from "vite";

const require = createRequire(import.meta.url);
const rootPackage = require("../package.json") as { version: string };
const PROD_ORIGIN = process.env.VITE_PROD_ORIGIN ?? "https://hctl.dev";
const BASE_PATH = process.env.VITE_BASE_URL ?? "/";

/**
 * Rewrite relative og:image / twitter:image URLs to absolute during production
 * builds. Social media crawlers require absolute URLs for unfurl previews.
 */
function ogAbsoluteUrls(): Plugin {
  let base = "/";
  return {
    name: "og-absolute-urls",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml(html) {
      if (process.env.NODE_ENV !== "production") {
        return html;
      }
      return html.replace(
        /(<meta\s+(?:property|name)="(?:og|twitter):image"\s+content=")([^"]+)(")/g,
        (_: string, before: string, url: string, after: string) => {
          if (url.startsWith("http")) {
            return before + url + after;
          }
          return before + PROD_ORIGIN + base + url + after;
        }
      );
    },
  };
}

export default defineConfig({
  define: {
    "import.meta.env.VITE_HCTL_VERSION": JSON.stringify(rootPackage.version),
  },
  plugins: [ogAbsoluteUrls()],
  root: ".",
  base: BASE_PATH,
  build: {
    outDir: "dist",
  },
});
