import { validateIntegrationDatabaseRoles } from "../shared/runtime-database";

export { validateIntegrationDatabaseRoles };

export default async function globalSetup() {
  await validateIntegrationDatabaseRoles();
}
