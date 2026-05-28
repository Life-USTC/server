import { prisma } from "@/lib/db/prisma";

const SNAPSHOT_CLIENT_NAME_PREFIX = "mcp-snapshot-";

export function createSnapshotOAuthClientName() {
  return `${SNAPSHOT_CLIENT_NAME_PREFIX}${Date.now()}`;
}

export async function cleanupSnapshotOAuthClients() {
  await prisma.oAuthClient.deleteMany({
    where: { name: { startsWith: SNAPSHOT_CLIENT_NAME_PREFIX } },
  });
}

export async function disconnectSnapshotOAuthCleanup() {
  await prisma.$disconnect();
}
