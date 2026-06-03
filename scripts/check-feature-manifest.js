#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const SHARED_ROOT = path.resolve(__dirname, "..");
const APPS_ROOT = path.dirname(SHARED_ROOT);
const OPEN_STATUSES = new Set(["planned", "in-progress", "ready-for-release"]);
const CLOSED_STATUSES = new Set(["complete", "deferred", "archived"]);
const VALID_STATUSES = new Set([...OPEN_STATUSES, ...CLOSED_STATUSES]);
const PASSING_TEST_STATUSES = new Set(["passed", "not-applicable"]);
const PASSING_PLATFORM_STATUSES = new Set(["passed", "not-applicable"]);

main();

function main() {
  const options = parseArgs(process.argv.slice(2));
  const appRoots = options.all ? discoverManagedApps() : [resolveAppRoot(options.appRoot || ".")];
  const failures = [];

  for (const appRoot of appRoots) {
    failures.push(...checkAppFeatureManifest(appRoot, options));
  }

  if (failures.length) {
    console.error("Feature manifest checks failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  const mode = options.strict ? "strict" : "format";
  console.log(`Feature manifest ${mode} checks passed for ${appRoots.map((dir) => path.basename(dir)).join(", ")}.`);
}

function parseArgs(args) {
  const options = {
    all: false,
    appRoot: "",
    strict: false
  };

  const positional = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--all") {
      options.all = true;
    } else if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length) options.appRoot = positional[0];
  return options;
}

function printUsage() {
  console.log([
    "Usage: node scripts/check-feature-manifest.js [app-root] [--strict] [--all]",
    "",
    "Format mode validates schema and linked briefs.",
    "Strict mode also blocks open features and requires completed evidence."
  ].join("\n"));
}

function checkAppFeatureManifest(appRoot, options) {
  const failures = [];
  const packagePath = path.join(appRoot, "package.json");
  const manifestPath = path.join(appRoot, "feature-test-manifest.json");
  const appName = fs.existsSync(packagePath)
    ? JSON.parse(fs.readFileSync(packagePath, "utf8")).name || path.basename(appRoot)
    : path.basename(appRoot);

  if (!fs.existsSync(manifestPath)) {
    failures.push(`${appName}: missing feature-test-manifest.json`);
    return failures;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    failures.push(`${appName}: feature-test-manifest.json is invalid JSON: ${error.message}`);
    return failures;
  }

  if (manifest.version !== 1) failures.push(`${appName}: feature-test-manifest.json version must be 1.`);
  if (manifest.app !== appName) failures.push(`${appName}: manifest app must match package name "${appName}".`);
  if (!Array.isArray(manifest.features)) failures.push(`${appName}: manifest features must be an array.`);
  if (!Array.isArray(manifest.features)) return failures;

  const ids = new Set();
  for (const feature of manifest.features) {
    const label = `${appName}:${feature.id || "(missing id)"}`;
    failures.push(...checkFeatureShape(appRoot, feature, label, ids));
    if (options.strict) failures.push(...checkFeatureReleaseReadiness(feature, label));
  }

  return failures;
}

function checkFeatureShape(appRoot, feature, label, ids) {
  const failures = [];
  if (!isPlainObject(feature)) {
    failures.push(`${label}: feature entry must be an object.`);
    return failures;
  }

  if (!/^[a-z0-9][a-z0-9-]*$/.test(String(feature.id || ""))) {
    failures.push(`${label}: id must use lower-kebab-case.`);
  } else if (ids.has(feature.id)) {
    failures.push(`${label}: duplicate feature id.`);
  } else {
    ids.add(feature.id);
  }

  if (!feature.title || typeof feature.title !== "string") failures.push(`${label}: title is required.`);
  if (!VALID_STATUSES.has(feature.status)) {
    failures.push(`${label}: status must be one of ${[...VALID_STATUSES].sort().join(", ")}.`);
  }
  if (typeof feature.visibleUi !== "boolean") failures.push(`${label}: visibleUi must be true or false.`);
  if (!feature.brief || typeof feature.brief !== "string") {
    failures.push(`${label}: brief path is required.`);
  } else {
    const briefPath = path.resolve(appRoot, feature.brief);
    const docsFeaturesRoot = path.resolve(appRoot, "docs", "features");
    if (!within(briefPath, docsFeaturesRoot)) {
      failures.push(`${label}: brief must live under docs/features/.`);
    } else if (!fs.existsSync(briefPath)) {
      failures.push(`${label}: brief file does not exist: ${feature.brief}`);
    }
  }

  for (const field of ["requirements", "acceptanceCriteria", "fixtures", "tests", "risks"]) {
    if (!Array.isArray(feature[field])) failures.push(`${label}: ${field} must be an array.`);
  }
  if (!isPlainObject(feature.humeDesign)) failures.push(`${label}: humeDesign must be an object.`);
  if (!isPlainObject(feature.crossPlatform)) failures.push(`${label}: crossPlatform must be an object.`);
  if (Array.isArray(feature.tests)) {
    feature.tests.forEach((test, index) => {
      if (!isPlainObject(test)) {
        failures.push(`${label}: tests[${index}] must be an object.`);
        return;
      }
      if (!test.name) failures.push(`${label}: tests[${index}].name is required.`);
      if (!test.command) failures.push(`${label}: tests[${index}].command is required.`);
      if (!test.status) failures.push(`${label}: tests[${index}].status is required.`);
    });
  }

  return failures;
}

function checkFeatureReleaseReadiness(feature, label) {
  const failures = [];
  if (OPEN_STATUSES.has(feature.status)) {
    failures.push(`${label}: status is ${feature.status}; mark complete, deferred, or archived before release.`);
    return failures;
  }

  if (feature.status !== "complete") return failures;

  if (!feature.requirements?.length) failures.push(`${label}: complete features must list requirements.`);
  if (!feature.acceptanceCriteria?.length) failures.push(`${label}: complete features must list acceptanceCriteria.`);
  if (feature.visibleUi && !feature.humeDesign?.reviewed) {
    failures.push(`${label}: visible UI features must set humeDesign.reviewed to true before release.`);
  }
  if (feature.visibleUi && !String(feature.humeDesign?.notes || "").trim()) {
    failures.push(`${label}: visible UI features must include humeDesign.notes.`);
  }

  const tests = Array.isArray(feature.tests) ? feature.tests : [];
  if (!tests.length) failures.push(`${label}: complete features must include test entries.`);
  tests.forEach((test, index) => {
    if (!PASSING_TEST_STATUSES.has(test.status)) {
      failures.push(`${label}: tests[${index}] "${test.name || "unnamed"}" must be passed or not-applicable.`);
    }
    if (test.status === "passed" && !String(test.evidence || "").trim()) {
      failures.push(`${label}: tests[${index}] "${test.name || "unnamed"}" needs evidence.`);
    }
  });

  for (const platform of ["mac", "windows"]) {
    const status = feature.crossPlatform?.[platform];
    if (!PASSING_PLATFORM_STATUSES.has(status)) {
      failures.push(`${label}: crossPlatform.${platform} must be passed or not-applicable.`);
    }
  }

  return failures;
}

function discoverManagedApps() {
  return fs.readdirSync(APPS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "automation-shared-resources")
    .map((entry) => path.join(APPS_ROOT, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, "package.json")))
    .filter((dir) => {
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
      return Boolean(manifest.scripts?.["sync:shared"] && manifest.scripts?.["smoke:ui"]);
    })
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

function resolveAppRoot(input) {
  const appRoot = path.resolve(process.cwd(), input);
  if (!fs.existsSync(path.join(appRoot, "package.json"))) {
    throw new Error(`App root does not contain package.json: ${appRoot}`);
  }
  return appRoot;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function within(filePath, rootPath) {
  const relative = path.relative(rootPath, filePath);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}
