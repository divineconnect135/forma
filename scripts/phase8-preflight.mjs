import console from "node:console";
import process from "node:process";

import { existsSync, readFileSync } from "node:fs";

import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

function pathFromRoot(path) {
  return join(root, path);
}

function readJson(path) {
  return JSON.parse(readFileSync(pathFromRoot(path), "utf8"));
}

console.log("\nFORMA — PHASE 8 PREFLIGHT\n");

let failures = 0;

function check(label, passed) {
  console.log(`${passed ? "PASS" : "FAIL"} — ${label}`);

  if (!passed) failures++;
}

// Check the expected npm workspace.
const files = [
  "package.json",
  "package-lock.json",
  "apps/api/package.json",
  "apps/api/tsconfig.build.json",
  "apps/web/package.json",
  "apps/web/index.html",
  "scripts/phase7-check.mjs",
];

for (const file of files) {
  check(file, existsSync(pathFromRoot(file)));
}

const rootPackage = readJson("package.json");
const apiPackage = readJson("apps/api/package.json");
const webPackage = readJson("apps/web/package.json");

check("Root build script", Boolean(rootPackage.scripts?.build));

check("API build script", Boolean(apiPackage.scripts?.build));

check("API production start script", Boolean(apiPackage.scripts?.start));

check("Frontend build script", Boolean(webPackage.scripts?.build));

// Ensure sensitive environment files have
// not accidentally been committed.
try {
  const tracked = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);

  const sensitiveFiles = tracked.filter((path) => {
    const filename = path.split("/").at(-1) ?? "";

    return (
      /^\.env(?:\..+)?$/.test(filename) &&
      !/\.(example|sample|template)$/.test(filename)
    );
  });

  check("No secrets tracked in .env files", sensitiveFiles.length === 0);

  if (sensitiveFiles.length > 0) {
    console.error("Review these tracked files:", sensitiveFiles);
  }
} catch (error) {
  console.error(
    "Git tracking check failed:",
    error instanceof Error ? error.message : String(error),
  );
  failures++;
}

// Print the environment variable names from
// the existing project example, never values.
const examplePath = "apps/api/.env.example";

if (existsSync(pathFromRoot(examplePath))) {
  const contents = readFileSync(pathFromRoot(examplePath), "utf8");

  const names = [
    ...contents.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/gm),
  ].map((match) => match[1]);

  console.log("\nBackend environment variable names:");

  for (const name of [...new Set(names)]) {
    console.log(`- ${name}`);
  }
} else {
  console.log("\nReview backend environment validation in src/config/env.ts.");
}

console.log("\nPreflight result:");

if (failures > 0) {
  console.error(`${failures} check(s) require attention.`);
  process.exitCode = 1;
} else {
  console.log("Static deployment checks passed.");
}

console.log(
  "\nThis does not replace automated tests, security review, or live deployment checks.",
);
