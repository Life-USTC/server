import {
  createToolPrisma,
  disconnectToolPrisma,
  type ToolPrismaClient,
} from "@tools/shared/tool-prisma";

export async function withE2ePrisma<T>(
  callback: (prisma: ToolPrismaClient) => Promise<T>,
) {
  const prisma = createToolPrisma();
  try {
    return await callback(prisma);
  } finally {
    await disconnectToolPrisma(prisma);
  }
}
