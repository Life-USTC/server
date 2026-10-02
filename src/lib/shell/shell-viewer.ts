import { getContext } from "svelte";
import type { Readable } from "svelte/store";
import type { LayoutUserSummary } from "@/lib/shell/layout-server-data";

export type ShellViewerState = {
  viewer: LayoutUserSummary;
  status: "loading" | "ready" | "error";
};

export const SHELL_VIEWER_CONTEXT = Symbol("shell-viewer");

/** One root-layout instance owns this state; it is never shared across SSR requests. */
export function getShellViewer(): Readable<ShellViewerState> {
  return getContext<Readable<ShellViewerState>>(SHELL_VIEWER_CONTEXT);
}
