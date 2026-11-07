import { getContext } from "svelte";
import type { Readable } from "svelte/store";
import type { DemoView } from "@/features/demo/lib/demo-types";
import type { LayoutUserSummary } from "@/lib/shell/layout-server-data";

export type ShellViewerState = {
  viewer: LayoutUserSummary;
  demo?: DemoView | null;
  status: "loading" | "ready" | "error";
};

export type ShellViewer = Readable<ShellViewerState> & {
  retry: () => Promise<void>;
};

export const SHELL_VIEWER_CONTEXT = Symbol("shell-viewer");

/** One root-layout instance owns this state; it is never shared across SSR requests. */
export function getShellViewer(): ShellViewer {
  return getContext<ShellViewer>(SHELL_VIEWER_CONTEXT);
}
