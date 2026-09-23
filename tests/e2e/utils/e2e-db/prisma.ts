import {
  createFixturePrisma,
  disconnectTestPrisma,
  type TestPrismaClient,
} from "../../../shared/prisma";

export async function withE2ePrisma<T>(
  callback: (prisma: TestPrismaClient) => Promise<T>,
) {
  const prisma = createFixturePrisma();
  try {
    return await callback(prisma);
  } finally {
    await disconnectTestPrisma(prisma);
  }
}
