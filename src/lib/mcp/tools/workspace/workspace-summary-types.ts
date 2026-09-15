import type { getAssistantWorkspaceSnapshot } from "@/features/workspace/server/workspace-snapshot";

export type WorkspaceSnapshot = Awaited<
  ReturnType<typeof getAssistantWorkspaceSnapshot>
>;
export type WorkspaceSection =
  WorkspaceSnapshot["subscriptions"]["currentSemesterSections"][number];
export type WorkspaceTodo = WorkspaceSnapshot["todos"]["items"][number];
