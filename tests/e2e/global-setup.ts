import { readFileSync } from "node:fs";
import { DEV_SEED } from "../fixtures/dev-seed";
import { validateIntegrationDatabaseRoles } from "../shared/runtime-database";
import { publicationFixtureObjectCommand } from "./utils/e2e-db/publications";

export default async function globalSetup() {
  await validateIntegrationDatabaseRoles();
  // Seed the same local R2 state used by this shard's Worker. The poster and
  // inline image share this key, so neither needs the real upstream server.
  publicationFixtureObjectCommand(
    "put",
    `young-events/images/${DEV_SEED.youngEvent.imageUrl}`,
    readFileSync("public/images/icon.png"),
    "image/png",
  );
}
