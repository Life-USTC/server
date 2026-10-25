/** Use independent credentials against the fixture's private database. */
export function staticImporterConnection(databaseName: string) {
  const connection = process.env.IMPORTER_DATABASE_URL?.trim();
  if (!connection) throw new Error("IMPORTER_DATABASE_URL is required");
  const url = new URL(connection);
  url.pathname = `/${databaseName}`;
  return url.href;
}
