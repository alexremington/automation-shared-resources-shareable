# Managed App Pipeline

The managed app pipeline is the shared verification harness for Automation Projects apps. It discovers sibling managed apps, syncs shared resources, runs the selected verification tier, and writes evidence artifacts for each run.

For the end-to-end feature workflow from requirements intake through deployment, use `docs/FEATURE-DEVELOPMENT-WORKFLOW.md`.

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

Start a tracked feature from an individual managed app:

```bash
npm run feature:new -- missing-contact-id-refresh --title "Missing Contact ID refresh"
```

This creates `docs/features/<slug>.md` and updates `feature-test-manifest.json`. Keep the manifest status as `in-progress` while building. Before release, either mark it `complete` with requirements, acceptance criteria, Hume design review, cross-platform status, and test evidence, or mark it `deferred`/`archived` if it is intentionally not shipping.

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

## Feature Manifest Gate

Every managed app should keep a root-level `feature-test-manifest.json`. Normal app checks validate that the manifest and linked feature briefs are well-formed. The release tier additionally runs `npm run check:features`, which blocks release when:

- a feature is still `planned`, `in-progress`, or `ready-for-release`;
- a completed feature is missing requirements or acceptance criteria;
- a visible UI feature has not recorded Hume design review notes;
- tests are not marked `passed` or `not-applicable` with evidence;
- Mac or Windows status is not marked `passed` or `not-applicable`.

This makes product requirements, implementation, and smoke-test evidence part of the same release artifact.

## Future App Requirements

A future managed app should provide:

- `sync:shared`
- `check`
- `check:features`
- `check:windows`
- `check:shareable`
- `feature:new`
- `smoke:ui`
- `smoke:ui:local`

The app should keep workflow-specific fixtures under `tests/fixtures/` and import shared smoke-test mechanics from `vendor/managed-app/scripts/smoke-test-harness.js`.

Each app should also include `docs/HUME-DESIGN-REVIEW.md`. Visible feature work should update that review before implementation and use the managed release pipeline to confirm the built feature still aligns with Hume's minimalist, high-contrast, accessibility-first direction.
