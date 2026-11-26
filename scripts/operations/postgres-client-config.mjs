export function postgresClientConfig(connectionString) {
  const url = new URL(connectionString);
  if (url.searchParams.get("sslmode") === "require") {
    url.searchParams.set("uselibpqcompat", "true");
  }
  return { connectionString: url.toString() };
}
