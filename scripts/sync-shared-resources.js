#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const SHARED_ROOT = path.resolve(__dirname, "..");
const APP_ROOT = path.resolve(process.argv[2] || process.cwd());
const PUBLIC_ROOT = fs.existsSync(path.join(APP_ROOT, "public", "index.html"))
  ? path.join(APP_ROOT, "public")
  : APP_ROOT;

const copies = [
  ["css/managed-app-base.css", path.join(PUBLIC_ROOT, "vendor/managed-app/css/managed-app-base.css")],
  ["assets/politico-logo.svg", path.join(PUBLIC_ROOT, "vendor/managed-app/assets/politico-logo.svg")],
  ["scripts/managed-worker-client.js", path.join(PUBLIC_ROOT, "vendor/managed-app/scripts/managed-worker-client.js")],
  ["scripts/platform.js", path.join(APP_ROOT, "vendor/managed-app/scripts/platform.js")],
  ["scripts/playwright-loader.js", path.join(APP_ROOT, "vendor/managed-app/scripts/playwright-loader.js")],
  ["scripts/smoke-test-harness.js", path.join(APP_ROOT, "vendor/managed-app/scripts/smoke-test-harness.js")],
  ["scripts/setup-shared-playwright.js", path.join(APP_ROOT, "vendor/managed-app/scripts/setup-shared-playwright.js")]
];

main();

function main() {
  assertManagedApp(APP_ROOT);
  for (const [sourceRelative, targetPath] of copies) {
    copySharedFile(path.join(SHARED_ROOT, sourceRelative), targetPath);
  }
  console.log(`Synced shared resources into ${APP_ROOT}`);
}

function assertManagedApp(appRoot) {
  const packagePath = path.join(appRoot, "package.json");
  if (!fs.existsSync(packagePath)) {
    throw new Error(`Target is not a managed app folder: ${appRoot}`);
  }

  const manifest = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  if (!manifest.scripts?.["smoke:ui"]) {
    throw new Error(`Target package.json does not look like a managed app: ${packagePath}`);
  }
}

function copySharedFile(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}
