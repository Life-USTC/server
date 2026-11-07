import type { DemoIdentity } from "@/features/demo/lib/demo-types";
import type { ShellViewerState } from "@/lib/shell/shell-viewer";

/** Demo leaf data never grants ownership without the root shell's verified identity. */
export function workspaceCalendarOwner(
  shell: ShellViewerState,
  pageDemo?: DemoIdentity | null,
) {
  if (shell.demo) {
    const matches =
      shell.status === "ready" &&
      pageDemo?.fixtureVersion === shell.demo.fixtureVersion &&
      pageDemo?.expiresAt === shell.demo.expiresAt;
    return matches
      ? {
          id: `demo:${shell.demo.fixtureVersion}`,
          epoch: `demo:${shell.demo.fixtureVersion}:${shell.demo.expiresAt}`,
        }
      : { id: "", epoch: "" };
  }
  const id = shell.viewer?.id ?? "";
  return { id, epoch: id };
}
