const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const requiredFiles = [
  "css/managed-app-base.css",
  "scripts/playwright-loader.js",
  "scripts/setup-shared-playwright.js",
  "scripts/sync-shared-resources.js"
];

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required shared resource: ${file}`);
  }
}

for (const file of requiredFiles.filter((file) => file.endsWith(".js"))) {
  require("node:child_process").execFileSync(process.execPath, ["--check", path.join(root, file)], {
    stdio: "inherit"
  });
}

console.log("Shared resources check passed.");
