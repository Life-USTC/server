import { runCommand, runMain } from "./run-steps";

await runMain(async () => {
  await runCommand("bun", ["run", "svelte-kit", "sync"], { quiet: true });
  await runCommand("bun", ["run", "db", "generate"], { quiet: true });
  await runCommand("bun", ["run", "tools/build/openapi/generate-spec.ts"], {
    quiet: true,
  });
  await runCommand("bun", ["run", "vite", "build"], { quiet: true });
});
