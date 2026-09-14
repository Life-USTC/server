import {
  createTestPrisma,
  disconnectTestPrisma,
  type TestPrismaClient,
} from "../../../shared/prisma";

export async function withE2ePrisma<T>(
  callback: (prisma: TestPrismaClient) => Promise<T>,
) {
  const fixtureDatabaseUrl = process.env.FUNCTION_OWNER_DATABASE_URL;
  if (!fixtureDatabaseUrl) {
    throw new Error(
      "FUNCTION_OWNER_DATABASE_URL is required for E2E fixture database access",
    );
  }
  const prisma = createTestPrisma(fixtureDatabaseUrl);
  try {
    return await callback(prisma);
  } finally {
    await disconnectTestPrisma(prisma);
  }
}
