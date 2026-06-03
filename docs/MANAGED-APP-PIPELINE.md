# Managed App Pipeline

The managed app pipeline is the shared verification harness for Automation Projects apps. It discovers sibling managed apps, syncs shared resources, runs the selected verification tier, and writes evidence artifacts for each run.

## Tiers

- `fast`: sync shared resources and run `npm run check`.
- `smoke`: run `fast`, then `npm run smoke:ui:local`.
- `release`: run `smoke`, plus `npm run check:windows` and `npm run check:shareable`.

Each tier starts with the shared-resource `check`, which includes Hume's design gate. That gate verifies the shared designer brief, the current design proposal artifact, each app's `docs/HUME-DESIGN-REVIEW.md`, visible focus styling, the no-body-scroll-lock rule, and explicit overlap review.

For visible feature work, the build process should start from Hume's minimalist, high-contrast, accessibility-first design direction before implementation. The testing process should then confirm that the built feature still matches that design intent, including whitespace, legibility, no unintentional overlap, reachable controls, and available scrolling.

## Commands

From `automation-shared-resources`, run every managed app:

```bash
npm run verify:fast
npm run verify:smoke
npm run verify:release
```

From an individual managed app, run only that app:

```bash
npm run verify:fast
npm run verify:smoke
npm run verify:release
```

From an individual managed app, run the default smoke tier across all managed apps:

```bash
npm run verify:all
```

List discovered managed apps:

```bash
node ../automation-shared-resources/scripts/managed-app-pipeline.js --list
```

## Evidence

Each run writes evidence under the Apps root:

```text
.managed-app-pipeline/<timestamp>-<tier>/
```

The evidence folder contains:

- `summary.json`: machine-readable run details, timings, exit codes, and log paths.
- `summary.md`: readable release evidence table.
- one log file per package/script step.

Use `summary.md` as the release checklist evidence before pushing private and shareable branches.

## Future App Requirements

A future managed app should provide:

- `sync:shared`
- `check`
- `check:windows`
- `check:shareable`
- `smoke:ui`
- `smoke:ui:local`

The app should keep workflow-specific fixtures under `tests/fixtures/` and import shared smoke-test mechanics from `vendor/managed-app/scripts/smoke-test-harness.js`.

Each app should also include `docs/HUME-DESIGN-REVIEW.md`. Visible feature work should update that review before implementation and use the managed release pipeline to confirm the built feature still aligns with Hume's minimalist, high-contrast, accessibility-first direction.
