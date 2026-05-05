/**
 * Generate OG image for social media unfurls (Slack, Twitter, Facebook).
 *
 * Composes a 1200x630 SVG with the hctl "H" logo and Departure Mono
 * font, then rasterises it to PNG via @resvg/resvg-js.
 *
 * Usage:  node scripts/generate-og-image.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const websiteDir = join(__dirname, "..");

const fontBuffer = readFileSync(
  join(websiteDir, "public/fonts/DepartureMono-Regular.woff")
);

// ── Image parameters ─────────────────────────────────────────────────────────

const W = 1200;
const H = 630;
const BG = "#0c0c1a";
const ACCENT = "#0891b2"; // teal — matches favicon
const DIM = "#64748b";
const TAGLINE = "Unified CLI for Hetzner Robot, Cloud &amp; Server Auction";
const FOOTER = "hctl.dev";

// ── Recreate the favicon "H" mark as embedded SVG paths ──────────────────────
// Scaled-up version of the favicon.svg H-mark (originally 512x512)

const logoScale = 0.38;
const logoW = 512 * logoScale;
const logoX = (W - logoW) / 2;
const logoY = 100;

// ── Compose SVG ──────────────────────────────────────────────────────────────

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <!-- Scanline pattern -->
    <pattern id="scanlines" width="${W}" height="4" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="${W}" y2="0" stroke="${ACCENT}" stroke-width="0.5" opacity="0.05"/>
    </pattern>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="${BG}"/>

  <!-- Subtle radial glow behind logo -->
  <radialGradient id="glow" cx="50%" cy="35%" r="30%">
    <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.1"/>
    <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
  </radialGradient>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- Scanlines overlay -->
  <rect width="${W}" height="${H}" fill="url(#scanlines)"/>

  <!-- Corner brackets (pixel-art frame) -->
  <g stroke="${ACCENT}" stroke-width="3" fill="none" opacity="0.3">
    <polyline points="50,90 50,50 90,50"/>
    <polyline points="${W - 90},50 ${W - 50},50 ${W - 50},90"/>
    <polyline points="50,${H - 90} 50,${H - 50} 90,${H - 50}"/>
    <polyline points="${W - 90},${H - 50} ${W - 50},${H - 50} ${W - 50},${H - 90}"/>
  </g>

  <!-- H logo mark (from favicon.svg, scaled) -->
  <g transform="translate(${logoX}, ${logoY}) scale(${logoScale})">
    <rect x="16" y="16" width="480" height="480" rx="64" ry="64" fill="${ACCENT}"/>
    <rect x="112" y="96" width="80" height="320" rx="8" fill="#ffffff"/>
    <rect x="320" y="96" width="80" height="320" rx="8" fill="#ffffff"/>
    <rect x="112" y="216" width="288" height="80" rx="8" fill="#ffffff"/>
    <rect x="352" y="376" width="32" height="8" rx="2" fill="#22d3ee"/>
  </g>

  <!-- Project name -->
  <text x="${W / 2}" y="360"
        text-anchor="middle"
        font-family="Departure Mono, monospace"
        font-size="52"
        fill="${ACCENT}"
        letter-spacing="2">
    hctl
  </text>

  <!-- Tagline -->
  <text x="${W / 2}" y="420"
        text-anchor="middle"
        font-family="Departure Mono, monospace"
        font-size="22"
        fill="${DIM}"
        opacity="0.9">
    ${TAGLINE}
  </text>

  <!-- Feature pills -->
  <g font-family="Departure Mono, monospace" font-size="16" text-anchor="middle">
    <text x="${W / 2 - 200}" y="475" fill="${ACCENT}" opacity="0.6">Robot API</text>
    <text x="${W / 2 - 70}" y="475" fill="${DIM}" opacity="0.4">|</text>
    <text x="${W / 2}" y="475" fill="${ACCENT}" opacity="0.6">Cloud API</text>
    <text x="${W / 2 + 70}" y="475" fill="${DIM}" opacity="0.4">|</text>
    <text x="${W / 2 + 200}" y="475" fill="${ACCENT}" opacity="0.6">Server Auction</text>
  </g>

  <!-- Footer URL -->
  <text x="${W / 2}" y="${H - 50}"
        text-anchor="middle"
        font-family="Departure Mono, monospace"
        font-size="18"
        fill="${ACCENT}"
        opacity="0.3">
    ${FOOTER}
  </text>
</svg>`;

// ── Render to PNG ────────────────────────────────────────────────────────────

const resvg = new Resvg(svg, {
  fitTo: { mode: "original" },
  font: {
    fontBuffers: [fontBuffer],
    loadSystemFonts: false,
  },
});

const pngData = resvg.render();
const pngBuffer = pngData.asPng();

const outPath = join(websiteDir, "public/og-image.png");
writeFileSync(outPath, pngBuffer);

const sizeKB = (pngBuffer.length / 1024).toFixed(1);
console.log(`\u2713 Generated ${outPath} (${W}\u00d7${H}, ${sizeKB} KB)`);
