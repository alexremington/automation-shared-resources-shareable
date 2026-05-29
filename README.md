# Automation Shared Resources

Shared source files for managed Automation Projects apps.

Apps should not depend on this folder at runtime. Instead, run each app's `npm run sync:shared` command to copy the relevant files into the app-local `vendor/managed-app/` folder. That keeps releases self-contained and avoids fragile relative paths, symlinks, and OneDrive-specific behavior.

## Contents

- `css/managed-app-base.css`: common design tokens, reset rules, focus rings, and base form behavior.
- `scripts/managed-worker-client.js`: shared Web Worker job runner for CPU-heavy browser work. It handles one active job at a time, cancels superseded jobs, forwards progress events, terminates workers cleanly, and falls back to an app-provided main-thread implementation when worker startup fails.
- `scripts/playwright-loader.js`: shared Playwright module resolver for local and CI smoke tests.
- `scripts/setup-shared-playwright.js`: shared Playwright installer for managed apps.
- `scripts/sync-shared-resources.js`: copies shared resources into an app.

App-specific worker entry points stay in each app. Shared resources own the worker lifecycle plumbing; each app owns its parsing, matching, rendering, and business logic.

## App Usage

From a managed app folder:

```bash
npm run sync:shared
```

For local smoke tests:

```bash
npm run setup:playwright
```

The shared Playwright package install lives next to the managed apps in:

```text
.shared-playwright
```
