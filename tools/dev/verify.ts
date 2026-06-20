import { access, readFile } from "node:fs/promises";
import { runCommand, runMain } from "./run-steps";

const OPENAPI_GENERATED_PATH = "public/openapi.generated.json";

async function ensureGeneratedOpenApiFresh() {
  const before = await readFile(OPENAPI_GENERATED_PATH, "utf8");
  await runCommand("bun", ["run", "tools/build/openapi/generate-spec.ts"], {
    quiet: true,
  });
  const after = await readFile(OPENAPI_GENERATED_PATH, "utf8");
  if (before !== after) {
    throw new Error(
      `${OPENAPI_GENERATED_PATH} was stale. Re-run verify after reviewing and keeping the generated diff.`,
    );
  }
}

async function ensurePlaywrightChromiumInstalled() {
  const { chromium } = await import("@playwright/test");
  const executablePath = chromium.executablePath();

  try {
    await access(executablePath);
  } catch {
    throw new Error(
      [
        `Playwright Chromium is not installed at ${executablePath}.`,
        "Run `bunx playwright install chromium` before browser/E2E checks.",
        "On Linux CI-like environments, use `bunx playwright install --with-deps chromium` if system libraries are missing.",
      ].join("\n"),
    );
  }
}

async function runDefaultVerify() {
  await runCommand("bun", ["run", "biome", "check"], { quiet: true });
  await runCommand("bun", [
    "--silent",
    "run",
    "tools/dev/check.ts",
    "contracts",
  ]);
  await runCommand("bun", ["--silent", "run", "tools/dev/check.ts", "i18n"]);
  await runCommand("bun", ["--silent", "run", "tools/dev/check.ts", "routes"]);
  await runCommand("bun", ["run", "svelte-kit", "sync"], { quiet: true });
  await runCommand("bun", ["run", "db", "generate"], { quiet: true });
  await ensureGeneratedOpenApiFresh();
  await runCommand(
    "bun",
    ["run", "svelte-check", "--tsconfig", "./tsconfig.json"],
    { quiet: true },
  );
  await runCommand(
    "bun",
    ["run", "tsc", "--noEmit", "-p", "tsconfig.typecheck.json"],
    { quiet: true },
  );
  await runCommand(
    "bun",
    ["run", "tsc", "--noEmit", "-p", "tsconfig.typecheck.tests.json"],
    { quiet: true },
  );
  await runCommand(
    "bun",
    ["run", "tsc", "--noEmit", "-p", "tsconfig.typecheck.operational.json"],
    { quiet: true },
  );
  await runCommand("bun", ["--silent", "run", "test"]);
}

async function runFullVerify() {
  await runDefaultVerify();
  await runCommand("bun", ["run", "db", "migrate", "deploy"], { quiet: true });
  await runCommand("bun", ["run", "seed"], { quiet: true });
  await runCommand(
    "bun",
    ["run", "vitest", "run", "--config", "vitest.integration.config.ts"],
    { quiet: true },
  );
  await runCommand("bun", ["--silent", "run", "tools/dev/check.ts", "e2e"]);
  await runCommand("bun", ["--silent", "run", "build"]);
  await runCommand("bun", ["--silent", "run", "tools/dev/e2e.ts", "prepare"]);
  await runCommand("bun", ["run", "seed"], { quiet: true });
  await ensurePlaywrightChromiumInstalled();
  await runCommand("bunx", ["playwright", "test", "--reporter=list"], {
    quiet: true,
  });
}

const mode = process.argv[2] ?? "default";

await runMain(async () => {
  if (mode === "default") {
    await runDefaultVerify();
    return;
  }

  if (mode === "full") {
    await runFullVerify();
    return;
  }

  console.error("Usage: bun run tools/dev/verify.ts [full]");
  process.exit(2);
});
