export function postgresClientConfig(connectionString) {
  const sslmode = new URL(connectionString).searchParams.get("sslmode");
  return {
    connectionString,
    ...(sslmode === "require" ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}
