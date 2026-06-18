import { runCommand, runMain } from "./run-steps";

await runMain(async () => {
  await runCommand("bun", ["run", "svelte-kit", "sync"]);
  await runCommand("bun", ["run", "db", "generate"]);
  await runCommand("bun", ["run", "db", "migrate", "deploy"]);
  await runCommand("bun", [
    "run",
    "vite",
    "dev",
    "--host",
    "127.0.0.1",
    "--port",
    "3000",
    "--strictPort",
  ]);
});
