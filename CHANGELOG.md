# Changelog

## [Unreleased]

### Fixed

- Suppress dotenv 17's `[dotenv@…] injecting env (0) from .env` banner that
  was leaking onto stdout for every command. The banner broke any consumer
  piping `hetzner --json …` into `jq` (cryptic
  `jq: parse error: Invalid numeric literal at line 1, column 15`). Both
  `config()` calls now pass `{ quiet: true }` (`src/cli.ts`,
  `src/shared/config.ts`).

## [2.4.0] - 2026-03-14

### Fixed

- Fix `deleteSshKey` crash when Hetzner Robot API returns 200 with empty body (#2)
- Handle empty response bodies gracefully using `response.text()` + `JSON.parse()` instead of `response.json()`

### Changed

- Consolidate shared helpers: `output()`, `confirmAction()`, and `handleActionError()` into `src/shared/helpers.ts`
- Cloud commands now use shared `output()` and `confirmAction()` instead of duplicate `cloudOutput()` / `cloudConfirm()`
- Refactor `asyncAction()` to inline client creation (removes module-level singleton)
- Add `auctionAction()` wrapper and `buildFilters()` helper to reduce duplication in auction commands
- Split `registerCloudServerCommands` (~580 → ~179 lines) into 24 handler functions
- Split `registerLoadBalancerCommands` (~502 → ~133 lines) into 18 handler functions
- Move auction types to `src/auction/types.ts` (re-exported from `src/types.ts` for backward compatibility)

### Security

- Resolve 4 dev-only dependency vulnerabilities via `npm audit fix`

## [2.3.1] - 2025-03-13

### Changed

- Add website link to README

## [2.3.0] - 2025-03-13

### Added

- `--output-schema` flag for LLM-friendly type introspection
- Ultracite + Biome for linting and formatting

## [2.2.0] - 2025-03-12

### Added

- Interactive website with terminal demo
- OG image and social meta tags
- GitHub Pages deployment workflow
