#!/usr/bin/env node

const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_EXCLUDES = new Set([
  ".git",
  "backups",
  "data",
  "dist",
  "incoming",
  "logs",
  "node_modules",
  "Output",
  "__pycache__"
]);

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = path.resolve(options.root || process.cwd());
  const files = options.changed
    ? changedJavaScriptFiles(root, options.excludes)
    : allJavaScriptFiles(root, options.excludes);

  if (!files.length) {
    console.log(options.changed ? "No changed JavaScript files to check." : "No JavaScript files to check.");
    return;
  }

  const failures = await checkFiles(files, options.concurrency);
  if (failures.length) {
    console.error("JavaScript syntax checks failed:");
    for (const failure of failures) {
      console.error(`- ${path.relative(root, failure.file) || failure.file}`);
      if (failure.output) console.error(indent(failure.output.trim(), "  "));
    }
    process.exitCode = 1;
    return;
  }

  console.log(`JavaScript syntax checks passed for ${files.length} file${files.length === 1 ? "" : "s"}.`);
}

function parseArgs(args) {
  const options = {
    changed: false,
    concurrency: Math.max(1, Math.min(os.cpus().length || 2, 8)),
    excludes: new Set(DEFAULT_EXCLUDES),
    root: ""
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--changed") {
      options.changed = true;
    } else if (arg === "--concurrency") {
      options.concurrency = positiveInteger(requiredValue(args, index += 1, arg), arg);
    } else if (arg.startsWith("--concurrency=")) {
      options.concurrency = positiveInteger(arg.slice("--concurrency=".length), arg);
    } else if (arg === "--exclude") {
      options.excludes.add(requiredValue(args, index += 1, arg));
    } else if (arg.startsWith("--exclude=")) {
      options.excludes.add(arg.slice("--exclude=".length));
    } else if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    } else if (!options.root) {
      options.root = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function allJavaScriptFiles(root, excludes) {
  const files = [];
  walk(root, root, excludes, files);
  return files.sort((left, right) => left.localeCompare(right));
}

function walk(root, dir, excludes, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isExcluded(root, fullPath, excludes)) continue;
      walk(root, fullPath, excludes, files);
    } else if (entry.isFile() && entry.name.endsWith(".js") && !isExcluded(root, fullPath, excludes)) {
      files.push(fullPath);
    }
  }
}

function changedJavaScriptFiles(root, excludes) {
  const names = new Set([
    ...gitLines(root, ["diff", "--name-only", "--diff-filter=ACMRTUXB", "HEAD", "--", "*.js"]),
    ...gitLines(root, ["ls-files", "--others", "--exclude-standard", "--", "*.js"])
  ]);

  return [...names]
    .map((name) => path.resolve(root, name))
    .filter((file) => fs.existsSync(file) && !isExcluded(root, file, excludes))
    .sort((left, right) => left.localeCompare(right));
}

function gitLines(root, args) {
  try {
    const output = childProcess.execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function isExcluded(root, filePath, excludes) {
  const parts = path.relative(root, filePath).split(path.sep);
  return parts.some((part) => excludes.has(part));
}

async function checkFiles(files, concurrency) {
  const queue = [...files];
  const failures = [];
  const workerCount = Math.min(concurrency, queue.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (queue.length) {
      const file = queue.shift();
      if (!file) continue;
      const result = await nodeCheck(file);
      if (result) failures.push(result);
    }
  }));

  return failures.sort((left, right) => left.file.localeCompare(right.file));
}

function nodeCheck(file) {
  return new Promise((resolve) => {
    const child = childProcess.spawn(process.execPath, ["--check", file], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    const output = [];
    child.stdout.on("data", (chunk) => output.push(String(chunk)));
    child.stderr.on("data", (chunk) => output.push(String(chunk)));
    child.on("error", (error) => resolve({ file, output: error.message }));
    child.on("close", (code) => {
      resolve(code === 0 ? null : { file, output: output.join("") });
    });
  });
}

function positiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

function requiredValue(args, index, label) {
  if (index >= args.length || !args[index]) throw new Error(`${label} requires a value.`);
  return args[index];
}

function indent(text, prefix) {
  return text.split(/\r?\n/).map((line) => `${prefix}${line}`).join("\n");
}

function printUsage() {
  console.log([
    "Usage: node scripts/check-js-syntax.js [root] [options]",
    "",
    "Options:",
    "  --changed              Check only changed and untracked JavaScript files.",
    "  --concurrency N        Number of node --check workers. Default: up to 8.",
    "  --exclude NAME         Exclude a path segment. Can be repeated.",
    "  --help                 Show this help."
  ].join("\n"));
}
