import { afterAll, beforeAll } from "vitest";
import { ensureDevUserSubscribedToSeedSection } from "./cleanup";
import { createMcpHarness, type McpHarness } from "./client";
import { DEV_SEED, integrationUserEmail, prisma } from "./fixtures";

export type McpToolTestContext = {
  client: McpHarness;
  devUserId: string;
};

export type IsolatedMcpToolTestContext = {
  client: McpHarness;
  userId: string;
};

export type SubscribedIsolatedMcpToolTestContext =
  IsolatedMcpToolTestContext & {
    seedSectionId: number;
  };

export function createMcpToolTestContext(): McpToolTestContext {
  const context = {
    client: undefined as unknown as McpHarness,
    devUserId: "",
  };

  beforeAll(async () => {
    const user = await prisma.user.findFirst({
      where: { username: DEV_SEED.debugUsername },
      select: { id: true },
    });
    if (!user) {
      throw new Error(
        `Dev seed user "${DEV_SEED.debugUsername}" not found. ` +
          "See the repo root `AGENTS.md` for the required DB + seed setup.",
      );
    }
    context.devUserId = user.id;
    context.client = await createMcpHarness(user.id);
  });

  afterAll(async () => {
    await context.client?.close();
    await prisma.$disconnect();
  });

  return context;
}

/** Creates a throwaway user before the suite and drops it (plus the pool) after. */
function registerIsolatedUserLifecycle(
  context: IsolatedMcpToolTestContext,
  input: {
    emailPrefix: string;
    name: string;
    onReady?: (userId: string) => Promise<void>;
    cleanup?: (userId: string) => Promise<void>;
  },
) {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: integrationUserEmail(input.emailPrefix),
        name: input.name,
      },
      select: { id: true },
    });
    context.userId = user.id;
    context.client = await createMcpHarness(user.id);
    await input.onReady?.(context.userId);
  });

  afterAll(async () => {
    await context.client?.close();
    try {
      if (!context.userId) return;
      try {
        await input.cleanup?.(context.userId);
      } finally {
        await prisma.user.deleteMany({ where: { id: context.userId } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });
}

export function createIsolatedMcpToolTestContext(input: {
  emailPrefix: string;
  name: string;
  setup?: (userId: string) => Promise<void>;
  cleanup?: (userId: string) => Promise<void>;
}): IsolatedMcpToolTestContext {
  const context = {
    client: undefined as unknown as McpHarness,
    userId: "",
  };

  registerIsolatedUserLifecycle(context, { ...input, onReady: input.setup });

  return context;
}

export function createSubscribedIsolatedMcpToolTestContext(input: {
  emailPrefix: string;
  name: string;
  setup?: (userId: string, seedSectionId: number) => Promise<void>;
  cleanup?: (userId: string) => Promise<void>;
}): SubscribedIsolatedMcpToolTestContext {
  const context = {
    client: undefined as unknown as McpHarness,
    userId: "",
    seedSectionId: 0,
  };

  registerIsolatedUserLifecycle(context, {
    emailPrefix: input.emailPrefix,
    name: input.name,
    cleanup: input.cleanup,
    onReady: async (userId) => {
      context.seedSectionId =
        await ensureDevUserSubscribedToSeedSection(userId);
      await input.setup?.(userId, context.seedSectionId);
    },
  });

  return context;
}

export type EphemeralMcpUser = {
  client: McpHarness;
  userId: string;
  close: () => Promise<void>;
};

export async function createEphemeralMcpUser(input: {
  emailPrefix: string;
  name: string;
}): Promise<EphemeralMcpUser> {
  const user = await prisma.user.create({
    data: {
      email: integrationUserEmail(input.emailPrefix),
      name: input.name,
    },
    select: { id: true },
  });
  const client = await createMcpHarness(user.id);

  return {
    client,
    userId: user.id,
    async close() {
      await client.close();
      await prisma.user.deleteMany({ where: { id: user.id } });
    },
  };
}
