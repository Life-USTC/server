import { getContext } from "svelte";
import type { Readable } from "svelte/store";
import type { LayoutUserSummary } from "@/lib/shell/layout-server-data";

export type ShellViewerState = {
  viewer: LayoutUserSummary;
  status: "loading" | "ready" | "error";
};

export const SHELL_VIEWER_CONTEXT = Symbol("shell-viewer");

export type ShellViewerContext = Readable<ShellViewerState> & {
  invalidateIdentity(): void;
};

/** One root-layout instance owns this state; it is never shared across SSR requests. */
export function getShellViewer(): ShellViewerContext {
  return getContext<ShellViewerContext>(SHELL_VIEWER_CONTEXT);
}
