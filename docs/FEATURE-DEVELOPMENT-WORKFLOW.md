# Feature Development Workflow

This workflow applies to managed Automation Projects apps, including Salesforce Scheduler and Salesforce Duplicate Reviewer. It is designed to move feature requests from product requirements to deployed private and shareable builds without losing design, cross-platform, or smoke-test requirements.

## 1. Requirements Intake

Start from the user's requested outcome, not the implementation detail.

Start a new session for the task unless continuity is clearly required. Default to one session per feature, bug, review, release pass, or architecture question.

Capture:

- the user task or decision the feature supports;
- affected app, page, panel, and workflow;
- current behavior and requested behavior;
- required data sources, fixtures, and live integrations;
- platform expectations for Mac and Windows;
- success, failure, empty, loading, and rollback behavior;
- deployment target: private only, shareable only, or both.

If a requirement touches Salesforce writes, merges, scheduled jobs, local files, OneDrive, Excel workbooks, or credentials, record the safety boundary before coding.

If continuing from an older session, carry forward only:

- affected app or repo;
- active feature or bug;
- relevant files, commands, and blockers;
- any still-active approval for a high-cost step.

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

Before broad exploration or verification, identify the cheapest sufficient evidence path. Classify the next step as `low`, `medium`, or `high` expected Codex cost. Prefer `gpt-5.4 mini` for `low` and `medium` cost work when the current surface supports model choice. If the next step is `medium`, warn first in a short status update and explain why the narrower option is insufficient. If the next step is `high`, warn first and get user approval before proceeding.

Use the fastest sufficient tier:

```bash
npm run check
npm run smoke:ui:local
npm run verify:release
```

For faster iteration on narrow changes, prefer the changed-file and targeted managed pipeline options while building:

```bash
node ../automation-shared-resources/scripts/managed-app-pipeline.js --tier fast --app . --changed
node ../automation-shared-resources/scripts/managed-app-pipeline.js --tier targeted --app . --feature feature-id
```

The targeted tier only runs commands declared in `feature-test-manifest.json`; update the manifest before relying on it.

Add or update fixtures under `tests/fixtures/` for critical workflows. Use dummy data when live data would be slow, unsafe, or unreliable.

Every fixed user-visible bug should get a named regression assertion in either a check script or the Playwright smoke harness.

`High` Codex cost operations include:

- repo-wide scans outside the app or folder already in scope;
- opening large logs, generated artifacts, or many large files mainly for exploration;
- deep multi-commit history review;
- full release or multi-app smoke passes when targeted checks would answer the question;
- re-running an expensive failing step before narrowing the failure surface.

`Medium` Codex cost operations include:

- a full smoke or release pass for one app;
- opening one large log or file for a specific debugging need;
- broader searches across one repo after app-scoped searches were insufficient;
- reading several related files to trace one workflow end to end.

If model switching is unavailable in the current session, still follow the same cost classification and scope limits even when `gpt-5.4 mini` cannot be selected for `low` or `medium` cost work.

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

For every changed interactive element, the smoke test should assert the visible post-action state, not just that the element can be clicked. This is especially important for cached or memoized UI: include at least one count-preserving state transition, such as editing an existing value, relabeling a selected row, toggling the same control twice, or refreshing data where the number of rendered items stays the same.

If the feature manifest already declares the exact required test commands, use the targeted tier for lower-cost iteration:

```bash
node ../automation-shared-resources/scripts/managed-app-pipeline.js --tier targeted --app . --feature feature-id
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

Use the full release tier before shipping even when targeted checks passed during implementation.

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
