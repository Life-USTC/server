import { resolvePlaywrightServerRuntime } from "./e2e";

const response = await fetch(
  new URL("/", resolvePlaywrightServerRuntime().baseUrl),
).catch(() => null);

process.exit(response?.ok ? 0 : 1);
