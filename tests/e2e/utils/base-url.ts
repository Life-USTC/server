type E2EUrlEnvironment = {
  E2E_PORT?: string;
  PLAYWRIGHT_BASE_URL?: string;
};

export function resolveE2EBaseUrl(
  environment: E2EUrlEnvironment = process.env,
) {
  if (environment.PLAYWRIGHT_BASE_URL) {
    return new URL(environment.PLAYWRIGHT_BASE_URL).origin;
  }

  const port = environment.E2E_PORT ?? "3000";
  if (!/^\d+$/.test(port) || Number(port) > 65_535) {
    throw new Error("E2E_PORT must be a numeric TCP port.");
  }

  return `http://localhost:${port}`;
}
