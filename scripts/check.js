const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const requiredFiles = [
  "css/managed-app-base.css",
  "assets/politico-logo.svg",
  "docs/DESIGNER-AGENT.md",
  "docs/FEATURE-DEVELOPMENT-WORKFLOW.md",
  "docs/PERFORMANCE-CODE-MAP.md",
  "scripts/check-feature-manifest.js",
  "scripts/check-js-syntax.js",
  "scripts/managed-worker-client.js",
  "scripts/managed-app-pipeline.js",
  "scripts/feature-new.js",
  "scripts/check-hume-design.js",
  "scripts/platform.js",
  "scripts/playwright-loader.js",
  "scripts/smoke-test-harness.js",
  "scripts/setup-shared-playwright.js",
  "scripts/sync-shared-resources.js"
];

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required shared resource: ${file}`);
  }
}

require("node:child_process").execFileSync(process.execPath, [
  path.join(root, "scripts/check-js-syntax.js"),
  root
], {
  stdio: "inherit"
});

console.log("Shared resources check passed.");
