#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

main();

function main() {
  const options = parseArgs(process.argv.slice(2));
  const appRoot = resolveAppRoot(options.appRoot);
  const manifest = readPackageManifest(appRoot);
  const slug = normalizeSlug(options.slug || options.title || "");
  if (!slug) {
    throw new Error("Feature slug is required. Example: npm run feature:new -- missing-contact-id-refresh");
  }

  const title = options.title || titleFromSlug(slug);
  const manifestPath = path.join(appRoot, "feature-test-manifest.json");
  const featureBriefPath = path.join(appRoot, "docs", "features", `${slug}.md`);
  const feature = newFeatureRecord({
    slug,
    title,
    appName: manifest.name || path.basename(appRoot),
    briefPath: path.relative(appRoot, featureBriefPath)
  });

  if (fs.existsSync(featureBriefPath) && !options.force) {
    throw new Error(`Feature brief already exists: ${featureBriefPath}`);
  }

  const testManifest = readFeatureManifest(manifestPath, manifest.name || path.basename(appRoot));
  if (testManifest.features.some((item) => item.id === slug) && !options.force) {
    throw new Error(`Feature already exists in feature-test-manifest.json: ${slug}`);
  }

  fs.mkdirSync(path.dirname(featureBriefPath), { recursive: true });
  fs.writeFileSync(featureBriefPath, featureBriefTemplate(feature), "utf8");

  const nextFeatures = testManifest.features.filter((item) => item.id !== slug);
  nextFeatures.push(feature);
  nextFeatures.sort((a, b) => a.id.localeCompare(b.id));
  testManifest.features = nextFeatures;
  testManifest.updatedAt = new Date().toISOString();
  fs.writeFileSync(manifestPath, `${JSON.stringify(testManifest, null, 2)}\n`, "utf8");

  console.log(`Created feature brief: ${path.relative(appRoot, featureBriefPath)}`);
  console.log(`Updated manifest: ${path.relative(appRoot, manifestPath)}`);
  console.log("Next: fill the acceptance criteria and add/mark the Playwright assertions before release.");
}

function parseArgs(args) {
  const options = {
    appRoot: "",
    force: false,
    slug: "",
    title: ""
  };

  const positional = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--force") {
      options.force = true;
    } else if (arg === "--title") {
      options.title = requiredValue(args, index += 1, arg);
    } else if (arg.startsWith("--title=")) {
      options.title = arg.slice("--title=".length);
    } else if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length === 1) {
    options.slug = positional[0];
  } else if (positional.length >= 2) {
    options.appRoot = positional[0];
    options.slug = positional[1];
  }

  return options;
}

function printUsage() {
  console.log([
    "Usage: node scripts/feature-new.js [app-root] <feature-slug> [--title TITLE] [--force]",
    "",
    "From an app package:",
    "  npm run feature:new -- missing-contact-id-refresh --title \"Missing Contact ID refresh\""
  ].join("\n"));
}

function resolveAppRoot(input) {
  const appRoot = path.resolve(process.cwd(), input || ".");
  const packagePath = path.join(appRoot, "package.json");
  if (!fs.existsSync(packagePath)) {
    throw new Error(`App root does not contain package.json: ${appRoot}`);
  }
  return appRoot;
}

function readPackageManifest(appRoot) {
  return JSON.parse(fs.readFileSync(path.join(appRoot, "package.json"), "utf8"));
}

function readFeatureManifest(manifestPath, appName) {
  if (!fs.existsSync(manifestPath)) {
    return {
      version: 1,
      app: appName,
      updatedAt: new Date().toISOString(),
      features: []
    };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.features)) manifest.features = [];
  if (!manifest.version) manifest.version = 1;
  if (!manifest.app) manifest.app = appName;
  return manifest;
}

function newFeatureRecord({ slug, title, appName, briefPath }) {
  const now = new Date().toISOString();
  return {
    id: slug,
    title,
    app: appName,
    status: "in-progress",
    visibleUi: true,
    brief: normalizeRelativePath(briefPath),
    requirements: [],
    acceptanceCriteria: [],
    humeDesign: {
      reviewed: false,
      notes: ""
    },
    fixtures: [],
    tests: [
      {
        name: "Fast checks",
        command: "npm run check",
        status: "todo",
        evidence: ""
      },
      {
        name: "Targeted Playwright smoke",
        command: "npm run smoke:ui:local",
        status: "todo",
        evidence: ""
      },
      {
        name: "Release pipeline",
        command: "npm run verify:release",
        status: "todo",
        evidence: ""
      }
    ],
    crossPlatform: {
      mac: "todo",
      windows: "todo"
    },
    risks: [],
    createdAt: now,
    updatedAt: now
  };
}

function featureBriefTemplate(feature) {
  return `# ${feature.title}

Status: ${feature.status}
Manifest ID: ${feature.id}

## User Story

- Persona:
- Goal:
- Decision or action the user needs to complete:

## Requirements

- 

## Acceptance Criteria

- 

## Hume Design Direction

- Minimalist, high-contrast, accessible direction:
- Required visible states:
- Controls and interaction pattern:
- Whitespace, no-overlap, and scroll criteria:
- Keyboard, focus, and contrast criteria:
- Desktop success criteria:
- Mobile success criteria:

## Fixtures

- Required fixture data:
- Dummy data behavior:
- Live integration behavior:

## Test Plan

- Unit or contract checks:
- Targeted Playwright assertions:
- Cross-platform checks:
- Manual checks:

## Release Evidence

- Fast check evidence:
- Playwright evidence:
- Release pipeline evidence:
- Known gaps:
`;
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleFromSlug(slug) {
  return slug.split("-").filter(Boolean).map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(" ");
}

function normalizeRelativePath(value) {
  return String(value).split(path.sep).join("/");
}

function requiredValue(args, index, flag) {
  if (index >= args.length || args[index].startsWith("--")) {
    throw new Error(`Expected a value after ${flag}.`);
  }
  return args[index];
}
