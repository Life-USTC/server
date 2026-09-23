import { withUserDbContext } from "@/lib/db/prisma";
import { getUserRlsTransactionClient } from "@/lib/db/rls-context";
import {
  countWorkspaceStageQuery,
  countWorkspaceStageTransaction,
  type WorkspaceStageCounter,
} from "./workspace-stage-analytics";

export type WorkspaceUserSummary = {
  id: string;
  name: string | null;
  username: string | null;
};

export type WorkspaceSubscribedSection = {
  id: number;
  retiredAt?: Date | null;
  semesterId: number | null;
};

export type WorkspaceUserContext = {
  user: WorkspaceUserSummary & { calendarFeedToken: string | null };
  sectionIds: number[];
  subscribedSections: WorkspaceSubscribedSection[];
};

export async function getWorkspaceUserContext(
  userId: string,
  stageCounter?: WorkspaceStageCounter,
): Promise<WorkspaceUserContext | null> {
  countWorkspaceStageQuery(stageCounter);
  if (stageCounter && !getUserRlsTransactionClient()) {
    countWorkspaceStageTransaction(stageCounter);
  }
  const user = await withUserDbContext(userId, (tx) =>
    tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        calendarFeedToken: true,
        sectionSubscriptions: {
          select: {
            section: {
              select: { id: true, retiredAt: true, semesterId: true },
            },
          },
        },
      },
    }),
  );

  if (!user) return null;

  return {
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      calendarFeedToken: user.calendarFeedToken,
    },
    sectionIds: user.sectionSubscriptions.map((row) => row.section.id),
    subscribedSections: user.sectionSubscriptions.map((row) => row.section),
  };
}
