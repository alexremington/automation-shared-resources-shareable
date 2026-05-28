# Automation Shared Resources

Shared source files for managed Automation Projects apps.

Apps should not depend on this folder at runtime. Instead, run each app's `npm run sync:shared` command to copy the relevant files into the app-local `vendor/managed-app/` folder. That keeps releases self-contained and avoids fragile relative paths, symlinks, and OneDrive-specific behavior.

## Contents

- `css/managed-app-base.css`: common design tokens, reset rules, focus rings, and base form behavior.
- `scripts/playwright-loader.js`: shared Playwright module resolver for local and CI smoke tests.
- `scripts/setup-shared-playwright.js`: shared Playwright installer for managed apps.
- `scripts/sync-shared-resources.js`: copies shared resources into an app.

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
