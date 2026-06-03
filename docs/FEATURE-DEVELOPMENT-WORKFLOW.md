# Feature Development Workflow

This workflow applies to managed Automation Projects apps, including Salesforce Scheduler and Salesforce Duplicate Reviewer. It is designed to move feature requests from product requirements to deployed private and shareable builds without losing design, cross-platform, or smoke-test requirements.

## 1. Requirements Intake

Start from the user's requested outcome, not the implementation detail.

Capture:

- the user task or decision the feature supports;
- affected app, page, panel, and workflow;
- current behavior and requested behavior;
- required data sources, fixtures, and live integrations;
- platform expectations for Mac and Windows;
- success, failure, empty, loading, and rollback behavior;
- deployment target: private only, shareable only, or both.

If a requirement touches Salesforce writes, merges, scheduled jobs, local files, OneDrive, Excel workbooks, or credentials, record the safety boundary before coding.

## 2. Create The Feature Record

From the affected app root, create a tracked feature:

```bash
npm run feature:new -- feature-slug --title "Feature Title"
```

This creates:

- `docs/features/<feature-slug>.md`
- a `feature-test-manifest.json` entry

Keep the manifest status as `in-progress` while building.

## 3. Convert Requirements Into Acceptance Criteria

Fill the generated feature brief before implementation.

Required sections:

- requirements;
- acceptance criteria;
- Hume design direction;
- fixture needs;
- target Playwright assertions;
- cross-platform expectations;
- manual checks, if any;
- known risks.

Acceptance criteria should be testable. Avoid criteria that only describe intent, such as "make it cleaner"; translate them into observable behavior, such as "no visible control overlaps the side panel at 1440 px, 1024 px, or 390 px."

## 4. Hume Design Pass

For visible UI work, Hume's design direction must be recorded before implementation.

Minimum design review:

- workflow placement;
- information hierarchy;
- controls and labels;
- empty/loading/success/error states;
- keyboard and focus behavior;
- whitespace and no-overlap criteria;
- scrolling behavior;
- desktop and mobile layout expectations.

The implementation should preserve existing functionality unless the feature brief explicitly changes it.

## 5. Test Plan Before Code

Before code changes, identify the exact tests that will prove the feature works.

Use the fastest sufficient tier:

```bash
npm run check
npm run smoke:ui:local
npm run verify:release
```

Add or update fixtures under `tests/fixtures/` for critical workflows. Use dummy data when live data would be slow, unsafe, or unreliable.

Every fixed user-visible bug should get a named regression assertion in either a check script or the Playwright smoke harness.

## 6. Implementation

Implementation should stay scoped to the feature brief.

Default engineering rules:

- use existing app patterns and shared helpers;
- keep cross-platform process spawning, paths, and filesystem behavior behind shared platform helpers;
- keep credentials and destructive Salesforce actions server-side;
- avoid local browser-only assumptions;
- avoid scroll locks when content can exceed the viewport;
- avoid unintentional overlap;
- keep generated or non-clickable project files out of user-facing root folders where practical.

For frontend changes, use Hume's minimalist, high-contrast, accessibility-first design direction and the shared managed app CSS tokens.

## 7. Targeted Verification During Build

Run fast checks while iterating:

```bash
npm run check
```

Run targeted Playwright smoke when UI behavior changes:

```bash
npm run smoke:ui:local
```

For shared infrastructure changes, run from `automation-shared-resources`:

```bash
npm run check
npm run check:features
```

Capture evidence paths from smoke output when the feature brief needs screenshots or JSON output.

## 8. Close The Feature Manifest

Before release, update `feature-test-manifest.json`.

For shipped work:

- set `status` to `complete`;
- list requirements;
- list acceptance criteria;
- set `humeDesign.reviewed` to `true` for visible UI;
- add Hume notes;
- mark Mac and Windows as `passed` or `not-applicable`;
- mark every test as `passed` or `not-applicable`;
- add evidence paths or command output references for passed tests.

For work intentionally not shipping, set status to `deferred` or `archived` and keep a short risk note.

The strict feature gate blocks release when a feature is still `planned`, `in-progress`, or `ready-for-release`.

## 9. Release Verification

Run the full release pipeline from the affected app or from shared resources:

```bash
npm run verify:release
```

or:

```bash
cd ../automation-shared-resources
npm run verify:release
```

The release tier verifies:

- shared resource checks;
- Hume design gate;
- app syntax, metadata, contracts, and shareable safety;
- strict feature manifest gate;
- Windows portability checks;
- local Playwright smoke tests;
- shareable branch checks.

Keep the generated evidence:

```text
.managed-app-pipeline/<timestamp>-release/summary.md
```

## 10. Review Before Commit

Before committing:

```bash
git status --short
git diff --check
git diff --stat
```

Account for every modified, untracked, generated, or moved file. Do not leave untracked artifacts outside the feature scope.

## 11. Commit And Mirror

Commit private `main` first.

Then switch to `shareable` and cherry-pick the public-safe commit or commits:

```bash
git switch shareable
git cherry-pick <commit>
npm run verify:release
```

If the repo has both private and public remotes, push in this order:

```bash
git push origin main
git push origin shareable
git push public shareable:main
```

After pushing, switch back to `main` and confirm clean status.

## 12. Deployment Confirmation

After deployment:

- confirm private and shareable branches are in sync as intended;
- confirm public shareable repo received `shareable:main`;
- note any GitHub status-check bypass warnings separately from local pipeline evidence;
- verify the app launches from the user-facing launcher when launcher/runtime behavior changed;
- record any manual Windows or fresh-install evidence that cannot be automated locally.

## 13. Post-Release Follow-Up

If users report an issue after release:

1. Reproduce from logs, screenshots, or Playwright.
2. Add a regression assertion that would have caught it.
3. Fix the smallest responsible surface.
4. Rerun the relevant smoke and release tier.
5. Update the feature brief or manifest if the expected behavior changed.

This keeps each fix from becoming a one-off patch that can regress later.
