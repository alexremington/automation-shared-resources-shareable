#!/usr/bin/env node

const childProcess = require("node:child_process");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const SHARED_ROOT = path.resolve(__dirname, "..");
const APPS_ROOT = path.dirname(SHARED_ROOT);
const DEFAULT_CONCURRENCY = 2;
const TIERS = {
  fast: ["sync:shared", "check"],
  smoke: ["sync:shared", "check", "smoke:ui:local"],
  release: ["sync:shared", "check", "check:features", "check:windows", "smoke:ui:local", "check:shareable"]
};
const SHARED_STEPS = {
  fast: ["check"],
  smoke: ["check"],
  release: ["check"]
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!TIERS[options.tier]) {
    throw new Error(`Unknown tier "${options.tier}". Expected one of: ${Object.keys(TIERS).join(", ")}.`);
  }

  const discoveredApps = discoverManagedApps();
  const apps = resolveRequestedApps(discoveredApps, options.apps);
  if (options.list) {
    for (const app of discoveredApps) {
      console.log(`${app.name}\t${app.dir}`);
    }
    return;
  }
  if (!apps.length) {
    throw new Error("No managed apps matched this pipeline run.");
  }

  const runDir = options.outputDir || path.join(APPS_ROOT, ".managed-app-pipeline", `${timestampForPath(new Date())}-${process.pid}-${options.tier}`);
  await fsp.mkdir(runDir, { recursive: true });

  console.log(`Managed app pipeline: tier=${options.tier}, apps=${apps.map((app) => app.name).join(", ")}`);
  console.log(`Evidence: ${runDir}`);
  if (options.dryRun) console.log("Dry run: commands will be reported but not executed.");

  const startedAt = new Date();
  const results = [];
  if (options.includeShared) {
    results.push(...await runPackageSteps({
      name: "automation-shared-resources",
      dir: SHARED_ROOT,
      manifest: readPackageManifest(SHARED_ROOT)
    }, SHARED_STEPS[options.tier], runDir, options));
  }

  const appResults = await runApps(apps, TIERS[options.tier], runDir, options);
  for (const result of appResults.flat()) results.push(result);

  const finishedAt = new Date();
  const summary = {
    ok: results.every((result) => ["passed", "skipped", "dry-run"].includes(result.status)),
    tier: options.tier,
    apps: apps.map((app) => app.name),
    includeShared: options.includeShared,
    dryRun: options.dryRun,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    runDir,
    results
  };
  await writeSummary(runDir, summary);
  printSummary(summary);
  if (!summary.ok) process.exitCode = 1;
}

function parseArgs(args) {
  const options = {
    apps: [],
    concurrency: DEFAULT_CONCURRENCY,
    dryRun: false,
    includeShared: true,
    list: false,
    outputDir: "",
    tier: process.env.MANAGED_APP_PIPELINE_TIER || "smoke"
  };

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
    } else if (arg === "--concurrency") {
      options.concurrency = positiveInteger(requiredValue(args, index += 1, arg), arg);
    } else if (arg.startsWith("--concurrency=")) {
      options.concurrency = positiveInteger(arg.slice("--concurrency=".length), arg);
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--list") {
      options.list = true;
    } else if (arg === "--no-shared") {
      options.includeShared = false;
    } else if (arg === "--output-dir") {
      options.outputDir = path.resolve(requiredValue(args, index += 1, arg));
    } else if (arg.startsWith("--output-dir=")) {
      options.outputDir = path.resolve(arg.slice("--output-dir=".length));
    } else if (arg === "--tier") {
      options.tier = requiredValue(args, index += 1, arg);
    } else if (arg.startsWith("--tier=")) {
      options.tier = arg.slice("--tier=".length);
    } else if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printUsage() {
  console.log([
    "Usage: node scripts/managed-app-pipeline.js [options]",
    "",
    "Options:",
    "  --tier fast|smoke|release   Select the verification tier. Default: smoke",
    "  --app NAME_OR_PATH           Run one app. Can be repeated.",
    "  --apps A,B                   Run a comma-separated app list.",
    "  --concurrency N              Number of app pipelines to run at once. Default: 2",
    "  --output-dir PATH            Write evidence artifacts to PATH.",
    "  --no-shared                  Skip automation-shared-resources check.",
    "  --dry-run                    Print planned steps without executing them.",
    "  --list                       List discovered managed apps.",
    "  --help                       Show this help."
  ].join("\n"));
}

function discoverManagedApps() {
  return fs.readdirSync(APPS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "automation-shared-resources")
    .map((entry) => path.join(APPS_ROOT, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, "package.json")))
    .map((dir) => ({
      dir,
      manifest: readPackageManifest(dir)
    }))
    .filter((app) => Boolean(app.manifest.scripts?.["sync:shared"] && app.manifest.scripts?.["smoke:ui"]))
    .map((app) => ({
      ...app,
      name: app.manifest.name || path.basename(app.dir)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function resolveRequestedApps(discoveredApps, requestedApps) {
  if (!requestedApps.length) return discoveredApps;

  const matched = [];
  for (const requested of requestedApps) {
    const normalizedRequest = requested.trim();
    if (!normalizedRequest) continue;
    const possiblePath = path.resolve(process.cwd(), normalizedRequest);
    const app = discoveredApps.find((candidate) => (
      candidate.name === normalizedRequest ||
      path.basename(candidate.dir) === normalizedRequest ||
      candidate.dir === possiblePath
    ));
    if (!app) {
      throw new Error(`Managed app not found: ${requested}. Run with --list to see available apps.`);
    }
    if (!matched.some((candidate) => candidate.dir === app.dir)) matched.push(app);
  }
  return matched;
}

async function runApps(apps, steps, runDir, options) {
  const queue = [...apps];
  const allResults = [];
  const workerCount = Math.min(Math.max(options.concurrency, 1), queue.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (queue.length) {
      const app = queue.shift();
      if (!app) continue;
      allResults.push(await runPackageSteps(app, steps, runDir, options));
    }
  }));
  return allResults;
}

async function runPackageSteps(pkg, steps, runDir, options) {
  const results = [];
  for (const scriptName of steps) {
    const result = await runPackageScript(pkg, scriptName, runDir, options);
    results.push(result);
    if (result.status === "failed") break;
  }
  return results;
}

async function runPackageScript(pkg, scriptName, runDir, options) {
  const startedAt = new Date();
  const logPath = path.join(runDir, `${safeFileName(pkg.name)}-${safeFileName(scriptName)}.log`);
  if (!pkg.manifest.scripts?.[scriptName]) {
    const result = stepResult(pkg, scriptName, "skipped", startedAt, new Date(), logPath, 0);
    await writeStepLog(logPath, [`Skipped: ${pkg.name} does not define npm script "${scriptName}".`]);
    console.log(`[skip] ${pkg.name} ${scriptName}`);
    return result;
  }

  if (options.dryRun) {
    const result = stepResult(pkg, scriptName, "dry-run", startedAt, new Date(), logPath, 0);
    await writeStepLog(logPath, [`Dry run: npm run ${scriptName}`, `cwd: ${pkg.dir}`]);
    console.log(`[dry] ${pkg.name} npm run ${scriptName}`);
    return result;
  }

  console.log(`[run] ${pkg.name} npm run ${scriptName}`);
  const runResult = await spawnNpmScript(pkg.dir, scriptName, logPath);
  const finishedAt = new Date();
  const status = runResult.code === 0 ? "passed" : "failed";
  const result = stepResult(pkg, scriptName, status, startedAt, finishedAt, logPath, runResult.code, runResult.signal);
  const duration = formatDuration(result.durationMs);
  if (status === "passed") {
    console.log(`[pass] ${pkg.name} ${scriptName} (${duration})`);
  } else {
    console.error(`[fail] ${pkg.name} ${scriptName} (${duration})`);
    console.error(`       log: ${logPath}`);
    if (runResult.tail) console.error(indent(runResult.tail, "       "));
  }
  return result;
}

function spawnNpmScript(cwd, scriptName, logPath) {
  return new Promise((resolve) => {
    const command = process.platform === "win32" ? "npm.cmd" : "npm";
    const startedAt = new Date();
    const logStream = fs.createWriteStream(logPath, { flags: "w" });
    const tail = [];
    logStream.write(`$ npm run ${scriptName}\n`);
    logStream.write(`cwd: ${cwd}\n`);
    logStream.write(`startedAt: ${startedAt.toISOString()}\n\n`);
    const child = childProcess.spawn(command, ["run", scriptName], {
      cwd,
      env: { ...process.env, FORCE_COLOR: "0" },
      shell: false
    });
    const append = (chunk) => {
      const text = String(chunk || "");
      logStream.write(text);
      for (const line of text.split(/\r?\n/).filter(Boolean)) {
        tail.push(line);
        if (tail.length > 20) tail.shift();
      }
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", (error) => {
      append(`\n${error.message}\n`);
    });
    child.on("close", (code, signal) => {
      const finishedAt = new Date();
      logStream.write(`\nfinishedAt: ${finishedAt.toISOString()}\n`);
      logStream.write(`durationMs: ${finishedAt.getTime() - startedAt.getTime()}\n`);
      logStream.write(`exitCode: ${code == null ? "" : code}\n`);
      if (signal) logStream.write(`signal: ${signal}\n`);
      logStream.end(() => {
        resolve({
          code: code == null ? 1 : code,
          signal,
          tail: tail.join("\n")
        });
      });
    });
  });
}

function stepResult(pkg, scriptName, status, startedAt, finishedAt, logPath, exitCode, signal = null) {
  return {
    package: pkg.name,
    packageDir: pkg.dir,
    script: scriptName,
    status,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    exitCode,
    signal,
    logPath
  };
}

async function writeStepLog(logPath, lines) {
  await fsp.mkdir(path.dirname(logPath), { recursive: true });
  await fsp.writeFile(logPath, `${lines.join("\n")}\n`);
}

async function writeSummary(runDir, summary) {
  await fsp.writeFile(path.join(runDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  await fsp.writeFile(path.join(runDir, "summary.md"), summaryMarkdown(summary));
}

function summaryMarkdown(summary) {
  const lines = [
    `# Managed App Pipeline ${summary.ok ? "Passed" : "Failed"}`,
    "",
    `- Tier: ${summary.tier}`,
    `- Started: ${summary.startedAt}`,
    `- Finished: ${summary.finishedAt}`,
    `- Duration: ${formatDuration(summary.durationMs)}`,
    `- Apps: ${summary.apps.join(", ")}`,
    "",
    "| Package | Script | Status | Duration | Log |",
    "| --- | --- | --- | ---: | --- |"
  ];
  for (const result of summary.results) {
    lines.push(`| ${escapeMarkdown(result.package)} | \`${result.script}\` | ${result.status} | ${formatDuration(result.durationMs)} | ${escapeMarkdown(path.basename(result.logPath))} |`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function printSummary(summary) {
  const failed = summary.results.filter((result) => result.status === "failed");
  console.log("");
  console.log(`Managed app pipeline ${summary.ok ? "passed" : "failed"} in ${formatDuration(summary.durationMs)}.`);
  console.log(`Summary: ${path.join(summary.runDir, "summary.md")}`);
  if (failed.length) {
    console.log("Failed steps:");
    for (const result of failed) {
      console.log(`- ${result.package} ${result.script}: ${result.logPath}`);
    }
  }
}

function readPackageManifest(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
}

function timestampForPath(date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function safeFileName(value) {
  return String(value).replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "") || "step";
}

function formatDuration(durationMs) {
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function indent(text, prefix) {
  return String(text || "").split(/\r?\n/).map((line) => `${prefix}${line}`).join("\n");
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

function positiveInteger(value, flag) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function escapeMarkdown(value) {
  return String(value).replace(/[\\|]/g, "\\$&");
}
