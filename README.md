# Automation Shared Resources

Shared source files for managed Automation Projects apps.

Apps should not depend on this folder at runtime. Instead, run each app's `npm run sync:shared` command to copy the relevant files into the app-local `vendor/managed-app/` folder. That keeps releases self-contained and avoids fragile relative paths, symlinks, and OneDrive-specific behavior.

## Contents

- `css/managed-app-base.css`: common design tokens, reset rules, focus rings, base form behavior, and managed header brand typography.
- `assets/politico-logo.svg`: shared POLITICO header logo for managed apps.
- `scripts/managed-worker-client.js`: shared Web Worker job runner for CPU-heavy browser work. It handles one active job at a time, cancels superseded jobs, forwards progress events, terminates workers cleanly, and falls back to an app-provided main-thread implementation when worker startup fails.
- `scripts/managed-app-pipeline.js`: shared verification pipeline for managed apps. It discovers apps, syncs shared resources, runs check/smoke/release tiers, and writes evidence artifacts.
- `scripts/check-hume-design.js`: shared Hume design gate for app-level design review artifacts, visible focus styling, and no-scroll-lock requirements.
- `scripts/playwright-loader.js`: shared Playwright module resolver for local and CI smoke tests.
- `scripts/smoke-test-harness.js`: shared Playwright smoke-test helpers for loading Chromium, asserting visible interactive controls are reachable, and enforcing lightweight performance budgets.
- `scripts/setup-shared-playwright.js`: shared Playwright installer for managed apps.
- `scripts/sync-shared-resources.js`: copies shared resources into an app.

App-specific worker entry points stay in each app. Shared resources own the worker lifecycle plumbing; each app owns its parsing, matching, rendering, and business logic.

App-specific smoke fixtures and workflow assertions stay in each app. Shared resources own cross-app smoke-test plumbing so future apps inherit the same reachability, browser-loading, and performance-budget checks.

## App Usage

From a managed app folder:

```bash
npm run sync:shared
```

For local smoke tests:

```bash
npm run setup:playwright
```

Smoke tests should import reusable helpers from:

```js
const {
  assertPerformanceBudget,
  loadChromium,
  visibleInteractiveReachability
} = require("./vendor/managed-app/scripts/smoke-test-harness");
```

The shared Playwright package install lives next to the managed apps in:

```text
.shared-playwright
```

For full pipeline usage, see `docs/MANAGED-APP-PIPELINE.md`.

For Hume's design persona and feature-review rules, see `docs/DESIGNER-AGENT.md`.
