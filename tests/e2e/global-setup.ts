import { validateWorkerDatabaseRoles } from "./utils/worker-database-env";

export default async function globalSetup() {
  await validateWorkerDatabaseRoles();
}
