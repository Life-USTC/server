import type { DemoIdentity } from "@/features/demo/lib/demo-types";
import { workspaceCalendarOwner } from "@/features/workspace/lib/workspace-calendar-owner";
import type { ShellViewerState } from "@/lib/shell/shell-viewer";

/** Public data is shared by ordinary viewers, but never across a Demo transition. */
export function homePublicReadEpoch(
  shell: ShellViewerState,
  pageDemo?: DemoIdentity | null,
) {
  if (shell.demo) return workspaceCalendarOwner(shell, pageDemo).epoch;
  return pageDemo ? "" : "public";
}
