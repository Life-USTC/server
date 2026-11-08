import { homePublicReadEpoch } from "@/features/demo/lib/demo-home-owner";
import type { DemoIdentity } from "@/features/demo/lib/demo-types";
import type { AppLocale } from "@/i18n/config";
import type { ShellViewerState } from "@/lib/shell/shell-viewer";
import type { GlobalSearchRequestContext } from "./global-search-controller";

/** A Demo presentation identity grants fictional scope, never a real user principal. */
export function globalSearchRequestContext(
  shell: ShellViewerState,
  locale: AppLocale,
  pageDemo?: DemoIdentity | null,
): GlobalSearchRequestContext {
  const epoch = homePublicReadEpoch(shell, pageDemo);
  const userId = shell.status === "ready" ? (shell.viewer?.id ?? "") : "";
  return {
    locale,
    ownerKey: `${epoch}:${shell.status}:${userId}`,
    enabled: Boolean(epoch),
    includeWorkspace: Boolean(epoch && (shell.demo || userId)),
    expiresAt: shell.demo?.expiresAt,
  };
}
