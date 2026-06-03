#!/usr/bin/env node

const assert = require("node:assert/strict");
const platform = require("./platform");

const windowsEnv = {
  Path: "C:\\Windows\\System32;C:\\Program Files\\nodejs",
  ProgramFiles: "C:\\Program Files",
  "ProgramFiles(x86)": "C:\\Program Files (x86)",
  LOCALAPPDATA: "C:\\Users\\Alex\\AppData\\Local",
  APPDATA: "C:\\Users\\Alex\\AppData\\Roaming"
};

const winPath = platform.defaultCommandPath({
  platform: "win32",
  env: windowsEnv,
  execPath: "C:\\Program Files\\nodejs\\node.exe",
  homeDir: "C:\\Users\\Alex"
});
assert.match(winPath, /C:\\Program Files \(x86\)\\sf\\bin/);
assert.equal(new Set(winPath.toLowerCase().split(";")).size, winPath.split(";").length);
assert.ok(platform.salesforceCliCandidates({
  platform: "win32",
  env: windowsEnv,
  homeDir: "C:\\Users\\Alex"
}).includes("C:\\Program Files (x86)\\sf\\bin\\sf.cmd"));
assert.equal(platform.defaultSalesforceCliName("win32"), "sf.cmd");

const command = "C:\\Program Files (x86)\\sf\\bin\\sf.cmd";
const invocation = platform.commandInvocation(command, ["org", "login", "web", "--alias", "salesforce-prod"], {
  platform: "win32",
  envPrefix: "TEST_RUN"
});
assert.equal(invocation.command, "powershell.exe");
assert.equal(invocation.env.TEST_RUN_COMMAND, command);
assert.equal(invocation.env.TEST_RUN_ARGS_JSON, JSON.stringify(["org", "login", "web", "--alias", "salesforce-prod"]));
assert.ok(invocation.args.includes("-Command"));
assert.ok(invocation.args.at(-1).includes("$env:TEST_RUN_COMMAND"));

const unixPath = platform.defaultCommandPath({
  platform: "darwin",
  env: { PATH: "/opt/custom/bin:/usr/bin" }
});
assert.ok(unixPath.split(":").includes("/opt/homebrew/bin"));
assert.ok(unixPath.split(":").includes("/usr/local/bin"));

assert.equal(
  platform.defaultAppSupportDir("Salesforce Pull Scheduler", "salesforce-pull-scheduler", {
    platform: "win32",
    env: { APPDATA: "C:\\Users\\Alex\\AppData\\Roaming" },
    homeDir: "C:\\Users\\Alex"
  }),
  "C:\\Users\\Alex\\AppData\\Roaming\\Salesforce Pull Scheduler"
);

console.log("Platform helper checks passed.");
