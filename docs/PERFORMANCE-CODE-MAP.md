# Performance Code Map

Use this map before broad app changes. It keeps performance work and Codex context focused on the files most likely to matter.

## Shared Pipeline

- `scripts/managed-app-pipeline.js`: managed app discovery, verification tiers, changed-file checks, and targeted feature test execution.
- `scripts/check-js-syntax.js`: parallel JavaScript syntax checks and changed-file syntax checks.
- `scripts/smoke-test-harness.js`: shared Playwright reachability and performance-budget assertions.

Use `--changed` for local iteration when the app provides `check:changed`. Use `--tier targeted --feature <feature-id>` only after the feature manifest lists the exact test commands needed for that feature. Release runs should still use the full release tier.

## Salesforce Duplicate Reviewer

- `public/app.js`: browser matching, render paths, merge UI, and review state.
- `public/matching-worker.js`: worker wrapper for matching jobs.
- `server/server.js`: latest-file endpoints, Salesforce merge/pre-merge checks, Salesforce CLI auth, and Codex label handoff.
- `tests/playwright-smoke.js`: large dataset budget, interactive reachability, merge workflow, and regression coverage.
- `scripts/check-server-contracts.js`: local server API contracts and fake Salesforce merge checks.

Performance-sensitive browser paths:

- matching setup and candidate generation: `processMatchingJobOnMain`, `buildGroupsAsync`, `pairsFromBucketsAsync`;
- group list rendering: `renderGroups`, `renderPlainGroupList`, `renderVirtualGroupList`;
- detail and merge table rendering: `renderDetail`, `renderMergeWorkspace`, `renderComparisonTable`.

Performance-sensitive server paths:

- latest Contacts/Accounts JSON and CSV endpoints;
- Salesforce auth lookup through `sf org display`;
- pre-merge freshness check and SOAP merge request.

## Salesforce Scheduler

- `public/app.js`: job list rendering, run monitoring, Salesforce org/report wizard.
- `server/server.js`: job registry, status enrichment, direct/launchd execution, Salesforce CLI report lookup.
- `tests/playwright-smoke.js`: scheduler workflow and UI performance budgets.
- `scripts/check-server-contracts.js`: local API contracts.

Performance-sensitive browser paths:

- `loadJobs`, `renderJobList`, `renderJobs`;
- `monitorRunCompletion` and status polling;
- `loadSalesforceOrgs` and `lookupReportName`.

Performance-sensitive server paths:

- `/api/jobs` full enrichment;
- `/api/jobs/:id/status` polling enrichment;
- Salesforce org list/display/report lookup;
- filesystem status/log reads under the scheduler log root.

## API Parsimony

- Cache Salesforce CLI org/display results with short TTLs and invalidate on login.
- Cache report lookup results by org, instance URL, API version, and report ID.
- Keep Salesforce freshness checks immediately before destructive merges.
- Prefer local fake Salesforce fixtures in checks and Playwright smoke; do not use production Salesforce API calls in automated tests unless explicitly required.

## Codex Token Parsimony

- Start from this file, the feature brief, and the specific app files listed above.
- Use `rg` for narrow symbol searches before opening large files.
- Prefer targeted pipeline evidence during implementation, then full release evidence before shipping.
