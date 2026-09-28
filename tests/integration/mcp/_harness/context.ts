import { test } from "vitest";
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
      () =>
        fixturePrisma.featureOperationEvent.deleteMany({
          where: { userId: user.id },
        }),
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

type FixtureCleanup = { onCleanup: (cleanup: () => Promise<void>) => void };

export const mcpTest = test.extend(
  "mcpConnections",
  { scope: "file", auto: true },
  // biome-ignore lint/correctness/noEmptyPattern: Vitest parses fixture dependencies from this pattern.
  ({}, { onCleanup }) => {
    onCleanup(() =>
      cleanupMcpResources([
        () => fixturePrisma.$disconnect(),
        () => authPrisma.$disconnect(),
        () => runtimePrisma.$disconnect(),
      ]),
    );
    return true;
  },
);

export function actorFixture(input: UserOptions) {
  return async (
    { mcpConnections: _connections }: { mcpConnections: boolean },
    { onCleanup }: FixtureCleanup,
  ) => {
    const actor = await createEphemeralMcpUser(input);
    onCleanup(actor.close);
    return actor;
  };
}

export function readerFixture() {
  return async (
    { mcpConnections: _connections }: { mcpConnections: boolean },
    { onCleanup }: FixtureCleanup,
  ) => {
    const name = "MCP reader";
    const username = `reader${crypto.randomUUID().replaceAll("-", "").slice(0, 14)}`;
    const actor = await createEphemeralMcpUser({
      emailPrefix: "mcp-reader",
      name,
      setup: async (userId) => {
        await fixturePrisma.user.update({
          where: { id: userId },
          data: { username },
        });
      },
    });
    onCleanup(actor.close);
    return { ...actor, name, username };
  };
}

export function academicActorFixture(input: UserOptions) {
  return async (
    { mcpConnections: _connections }: { mcpConnections: boolean },
    { onCleanup }: FixtureCleanup,
  ) => {
    const actor = await createEphemeralMcpUser(input);
    let section:
      | Awaited<ReturnType<typeof createSubscribedAcademicFixture>>
      | undefined;
    onCleanup(() =>
      cleanupMcpResources([
        async () => {
          if (section) await deleteAcademicFixture(section.id);
        },
        actor.close,
      ]),
    );
    section = await createSubscribedAcademicFixture(actor.userId);
    return {
      ...actor,
      sectionId: section.id,
      sectionJwId: section.jwId,
      sectionCode: section.code,
    };
  };
}
