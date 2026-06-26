const DEFAULT_APP_DEV_PORT = "3000";
const DEFAULT_APP_HEALTH_ORIGIN = "http://127.0.0.1";

export function resolveAppHealthUrl(env: NodeJS.ProcessEnv = process.env) {
  const explicitUrl = env.APP_HEALTH_URL?.trim();
  if (explicitUrl) return new URL(explicitUrl);

  const port = env.APP_DEV_PORT?.trim() || DEFAULT_APP_DEV_PORT;
  return new URL("/", `${DEFAULT_APP_HEALTH_ORIGIN}:${port}`);
}

export async function checkAppHealth(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl(resolveAppHealthUrl(env)).catch(() => null);
  return response?.ok === true;
}

if (process.argv[1]?.endsWith("health.ts")) {
  try {
    process.exit((await checkAppHealth()) ? 0 : 1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
