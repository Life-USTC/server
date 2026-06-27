import {
  createTestPrisma,
  disconnectTestPrisma,
  type TestPrismaClient,
} from "../../../shared/prisma";

export async function withE2ePrisma<T>(
  callback: (prisma: TestPrismaClient) => Promise<T>,
) {
  const prisma = createTestPrisma();
  try {
    return await callback(prisma);
  } finally {
    await disconnectTestPrisma(prisma);
  }
}
