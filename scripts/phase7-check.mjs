import { spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import console from "node:console";

// ============================================
// FORMA — PHASE 7 FINAL VERIFICATION
// ============================================

// Resolve the Forma project root.
//
// File location:
// forma/scripts/phase7-check.mjs
//
// Project root:
// forma/

const rootDirectory = fileURLToPath(new URL("../", import.meta.url));

// Support macOS, Linux, and Windows.
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

// ============================================
// VERIFICATION TASKS
// ============================================

const checks = [
  {
    name: "Backend TypeScript",
    args: ["run", "typecheck", "-w", "@forma/api"],
  },

  {
    name: "Frontend TypeScript",
    args: ["run", "typecheck", "-w", "@forma/web"],
  },

  {
    name: "Backend Integration Tests",
    args: ["run", "test", "-w", "@forma/api", "--", "--no-file-parallelism"],
  },

  {
    name: "Frontend Tests",
    args: ["run", "test", "-w", "@forma/web"],
  },

  {
    name: "ESLint",
    args: ["run", "lint"],
  },

  {
    name: "Production Build",
    args: ["run", "build"],
  },
];

// ============================================
// RUN VERIFICATION
// ============================================

console.log("\n====================================");

console.log("FORMA — PHASE 7 VERIFICATION");

console.log("====================================\n");

let allPassed = true;

for (const check of checks) {
  console.log(`\nRunning: ${check.name}`);

  const startedAt = Date.now();

  const result = spawnSync(npm, check.args, {
    cwd: rootDirectory,
    stdio: "inherit",
    env: process.env,
  });

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  // Handle process execution errors.
  if (result.error) {
    console.error(`\nFAILED: ${check.name}`);

    console.error(result.error);

    allPassed = false;
    break;
  }

  // Handle failed commands.
  if (result.status !== 0) {
    console.error(`\nFAILED: ${check.name}`);

    console.error(`Duration: ${seconds}s`);

    console.error(`Exit code: ${result.status}`);

    allPassed = false;
    break;
  }

  console.log(`PASSED: ${check.name} (${seconds}s)`);
}

// ============================================
// FINAL RESULT
// ============================================

if (!allPassed) {
  console.log("\n====================================");

  console.log("PHASE 7 VERIFICATION FAILED");

  console.log("====================================");

  console.log("\nFix the failed check and run the script again.");

  process.exitCode = 1;
} else {
  console.log("\n====================================");

  console.log("ALL AUTOMATED CHECKS PASSED");

  console.log("====================================");

  console.log("\nPhase 7 automated verification completed successfully.");

  console.log(
    "Manual browser, accessibility, and Stripe verification is still required.",
  );
}
