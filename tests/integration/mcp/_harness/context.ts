import { afterAll, afterEach, beforeEach } from "vitest";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import {
  createSubscribedAcademicFixture,
  deleteAcademicFixture,
} from "./academic-fixture";
import { cleanupMcpResources } from "./cleanup";
import { createMcpHarness, type McpHarness } from "./client";
import { prisma as fixturePrisma, integrationUserEmail } from "./fixtures";

export type IsolatedMcpToolTestContext = {
  client: McpHarness;
  userId: string;
};
export type McpToolTestContext = IsolatedMcpToolTestContext & {
  username: string;
  name: string;
};
export type SubscribedIsolatedMcpToolTestContext =
  IsolatedMcpToolTestContext & {
    sectionId: number;
    sectionJwId: number;
    sectionCode: string;
  };
type UserOptions = {
  emailPrefix: string;
  name: string;
  setup?: (userId: string) => Promise<void>;
  cleanup?: (userId: string) => Promise<void>;
};

export type EphemeralMcpUser = IsolatedMcpToolTestContext & {
  close: () => Promise<void>;
};

export async function createEphemeralMcpUser(
  input: UserOptions,
): Promise<EphemeralMcpUser> {
  const user = await fixturePrisma.user.create({
    data: { email: integrationUserEmail(input.emailPrefix), name: input.name },
    select: { id: true },
  });
  let client: McpHarness | undefined;
  async function close() {
    await cleanupMcpResources([
      async () => client?.close(),
      async () => input.cleanup?.(user.id),
      () =>
        fixturePrisma.auditLog.deleteMany({
          where: { OR: [{ userId: user.id }, { subjectUserId: user.id }] },
        }),
      () => fixturePrisma.comment.deleteMany({ where: { userId: user.id } }),
      () =>
        fixturePrisma.homework.deleteMany({ where: { createdById: user.id } }),
      () => fixturePrisma.user.deleteMany({ where: { id: user.id } }),
    ]);
  }
  try {
    client = await createMcpHarness(user.id);
    await input.setup?.(user.id);
    return { client, userId: user.id, close };
  } catch (error) {
    try {
      await close();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "MCP fixture initialization failed",
      );
    }
    throw error;
  }
}

function registerIsolatedUserLifecycle(
  context: IsolatedMcpToolTestContext,
  input: UserOptions,
) {
  let current: EphemeralMcpUser | undefined;
  beforeEach(async () => {
    current = await createEphemeralMcpUser(input);
    context.userId = current.userId;
    context.client = current.client;
  });
  afterEach(async () => {
    const finished = current;
    current = undefined;
    context.userId = "";
    await finished?.close();
  });
  // Pools outlive individual cases; closing them per case would affect another context.
  afterAll(async () => {
    await cleanupMcpResources([
      () => fixturePrisma.$disconnect(),
      () => authPrisma.$disconnect(),
      () => runtimePrisma.$disconnect(),
    ]);
  });
}

export function createMcpToolTestContext(): McpToolTestContext {
  const context = {
    client: undefined as unknown as McpHarness,
    userId: "",
    username: "",
    name: "MCP reader",
  };
  registerIsolatedUserLifecycle(context, {
    emailPrefix: "mcp-reader",
    name: context.name,
    setup: async (userId) => {
      context.username = `reader${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
      await fixturePrisma.user.update({
        where: { id: userId },
        data: { username: context.username },
      });
    },
  });
  return context;
}

/** A fresh actor for every case, with fixture setup independent of earlier mutations. */
export function createIsolatedMcpToolTestContext(
  input: UserOptions,
): IsolatedMcpToolTestContext {
  const context = { client: undefined as unknown as McpHarness, userId: "" };
  registerIsolatedUserLifecycle(context, input);
  return context;
}

export function createSubscribedIsolatedMcpToolTestContext(
  input: Omit<UserOptions, "setup"> & {
    setup?: (userId: string, sectionId: number) => Promise<void>;
  },
): SubscribedIsolatedMcpToolTestContext {
  const context = {
    client: undefined as unknown as McpHarness,
    userId: "",
    sectionId: 0,
    sectionJwId: 0,
    sectionCode: "",
  };
  registerIsolatedUserLifecycle(context, {
    ...input,
    setup: async (userId) => {
      context.sectionId = 0;
      const section = await createSubscribedAcademicFixture(userId);
      context.sectionId = section.id;
      context.sectionJwId = section.jwId;
      context.sectionCode = section.code;
      await input.setup?.(userId, section.id);
    },
    cleanup: async (userId) => {
      await cleanupMcpResources([
        async () => input.cleanup?.(userId),
        async () => {
          if (context.sectionId) await deleteAcademicFixture(context.sectionId);
        },
      ]);
    },
  });
  return context;
}
