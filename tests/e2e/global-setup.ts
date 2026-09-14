import { validateIntegrationDatabaseRoles } from "../shared/runtime-database";

export default async function globalSetup() {
  await validateIntegrationDatabaseRoles();
}
