import {
  type WorkspaceState,
  workspaceStateTest,
} from "./workspace-state-fixture";

type YoungWorkspace = WorkspaceState & {
  otherId: string;
  youngId: string;
  organizerId: string;
  queue: { send(message: unknown): Promise<void> };
};

export const youngWorkspaceTest = workspaceStateTest.extend<{
  young: YoungWorkspace;
}>({
  young: async ({ workspace, workspaceQueue, task }, use) => {
    const { db } = workspace;
    const marker = crypto.randomUUID();
    const otherId = `young-other-${marker}`;
    const youngId = `young-${marker}`;
    const organizerId = `organizer-${marker}`;
    await workspace.runtime(() =>
      db.$transaction(async (tx) => {
        await tx.user.create({
          data: { id: otherId, email: `${otherId}@test.invalid` },
        });
        await tx.youngOrganizer.create({
          data: {
            id: organizerId,
            name: "Workshop club",
            normalizedName: organizerId,
          },
        });
        await tx.youngEvent.create({
          data: {
            youngId,
            name: "[integration-test] Young workshop",
            isActive: true,
            rawJson: {},
            organizerId,
            sourceMissing: false,
            location: "East",
            startAt: new Date("2030-09-15T10:30:00+08:00"),
            endAt: new Date("2030-09-15T12:00:00+08:00"),
            applyStartAt: new Date("2030-09-14T08:00:00+08:00"),
            applyEndAt: new Date("2030-09-15T10:15:00+08:00"),
            createdAt: new Date("2030-09-14T09:00:00+08:00"),
          },
        });
      }),
    );
    task.context.signal.throwIfAborted();
    await use({
      ...workspace,
      otherId,
      youngId,
      organizerId,
      queue: workspaceQueue,
    });
  },
});
