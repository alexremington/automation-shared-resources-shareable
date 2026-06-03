#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const SHARED_ROOT = path.resolve(__dirname, "..");
const APPS_ROOT = path.dirname(SHARED_ROOT);
const REQUIRED_SHARED_FILES = [
  "docs/DESIGNER-AGENT.md",
  "docs/design-proposals/minimalist-accessible-redesign/README.md",
  "docs/design-proposals/minimalist-accessible-redesign/index.html",
  "docs/design-proposals/minimalist-accessible-redesign/duplicate-reviewer-redesign.png",
  "docs/design-proposals/minimalist-accessible-redesign/scheduler-redesign.png"
];
const REQUIRED_REVIEW_SECTIONS = [
  "## Hume Design Target",
  "## Current Alignment",
  "## Feature Request Review",
  "## Build And Test Gate"
];
const REQUIRED_REVIEW_TERMS = [
  "minimalist",
  "high-contrast",
  "accessibility",
  "current functionality",
  "scroll",
  "smoke"
];

main();

function main() {
  const options = parseArgs(process.argv.slice(2));
  const failures = [];

  for (const file of REQUIRED_SHARED_FILES) {
    if (!fs.existsSync(path.join(SHARED_ROOT, file))) {
      failures.push(`Missing shared Hume design artifact: ${file}`);
    }
  }

  const apps = resolveApps(options.apps);
  for (const app of apps) {
    failures.push(...checkAppReview(app));
    failures.push(...checkAppCss(app));
  }

  if (failures.length) {
    console.error("Hume design checks failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`Hume design checks passed for ${apps.map((app) => app.name).join(", ")}.`);
}

function parseArgs(args) {
  const options = { apps: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--app") {
      options.apps.push(requiredValue(args, index += 1, arg));
    } else if (arg.startsWith("--app=")) {
      options.apps.push(arg.slice("--app=".length));
    } else if (arg === "--apps") {
      options.apps.push(...splitCsv(requiredValue(args, index += 1, arg)));
    } else if (arg.startsWith("--apps=")) {
      options.apps.push(...splitCsv(arg.slice("--apps=".length)));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function resolveApps(requestedApps) {
  const apps = discoverManagedApps();
  if (!requestedApps.length) return apps;

  return requestedApps.map((requested) => {
    const requestedPath = path.resolve(process.cwd(), requested);
    const app = apps.find((candidate) => (
      candidate.name === requested ||
      path.basename(candidate.dir) === requested ||
      candidate.dir === requestedPath
    ));
    if (!app) throw new Error(`Managed app not found for Hume design check: ${requested}`);
    return app;
  });
}

function discoverManagedApps() {
  return fs.readdirSync(APPS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "automation-shared-resources")
    .map((entry) => path.join(APPS_ROOT, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, "package.json")))
    .map((dir) => ({
      dir,
      manifest: readJson(path.join(dir, "package.json"))
    }))
    .filter((app) => app.manifest.scripts?.["sync:shared"] && app.manifest.scripts?.["smoke:ui"])
    .map((app) => ({
      ...app,
      name: app.manifest.name || path.basename(app.dir)
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function checkAppReview(app) {
  const failures = [];
  const reviewPath = path.join(app.dir, "docs", "HUME-DESIGN-REVIEW.md");
  if (!fs.existsSync(reviewPath)) {
    return [`${app.name}: missing docs/HUME-DESIGN-REVIEW.md`];
  }

  const review = fs.readFileSync(reviewPath, "utf8");
  for (const section of REQUIRED_REVIEW_SECTIONS) {
    if (!review.includes(section)) failures.push(`${app.name}: Hume review missing ${section}`);
  }
  const lowerReview = review.toLowerCase();
  for (const term of REQUIRED_REVIEW_TERMS) {
    if (!lowerReview.includes(term)) failures.push(`${app.name}: Hume review missing required term "${term}"`);
  }
  return failures;
}

function checkAppCss(app) {
  const failures = [];
  const cssPath = path.join(app.dir, "public", "styles.css");
  if (!fs.existsSync(cssPath)) return failures;

  const css = fs.readFileSync(cssPath, "utf8");
  const bodyBlocks = css.match(/(?:^|[\s}])(?:html|body)\s*\{[^}]*\}/gi) || [];
  for (const block of bodyBlocks) {
    if (/overflow\s*:\s*hidden/i.test(block) || /overflow-y\s*:\s*hidden/i.test(block)) {
      failures.push(`${app.name}: body/html must not suppress vertical scrolling (${compactCssBlock(block)})`);
    }
  }
  if (!/:focus-visible\b/.test(css)) {
    failures.push(`${app.name}: styles.css must include visible focus-state styling with :focus-visible`);
  }
  return failures;
}

function compactCssBlock(block) {
  return block.replace(/\s+/g, " ").trim().slice(0, 160);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function splitCsv(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function requiredValue(args, index, flag) {
  if (index >= args.length || args[index].startsWith("--")) {
    throw new Error(`Expected a value after ${flag}.`);
  }
  return args[index];
}
