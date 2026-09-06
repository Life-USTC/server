<script lang="ts">
import { formatMessage } from "@/features/workspace/lib/overview";
import type {
  SignedWorkspaceData,
  WorkspaceCopy,
  WorkspaceOverviewLinkItem,
} from "@/features/workspace/lib/workspace-controller-helpers";
import OverviewLinksGrid from "./OverviewLinksGrid.svelte";
import OverviewSection from "./OverviewSection.svelte";
import OverviewTermSelectionCard from "./OverviewTermSelectionCard.svelte";
import type { WorkspaceCalendarTabHref } from "./workspace-calendar-component-types";

export let workspaceCopy: WorkspaceCopy;
export let workspaceTabHref: WorkspaceCalendarTabHref;
export let linkIconLabel: (icon: string) => string;
export let links: WorkspaceOverviewLinkItem[];
export let pendingTodosCount: number;
export let signedData: SignedWorkspaceData;
export let submitWorkspaceLinkPin: (
  slug: string,
  action: "pin" | "unpin",
) => void;
export let updatingCatalogLinkSlug: string | null;
</script>

<div class="grid gap-8">
  <OverviewLinksGrid
    {workspaceCopy}
    {workspaceTabHref}
    {linkIconLabel}
    {links}
    {submitWorkspaceLinkPin}
    {updatingCatalogLinkSlug}
  />

  <OverviewTermSelectionCard
    {workspaceCopy}
    {workspaceTabHref}
    description={signedData.overview?.hasAnySelection
      ? workspaceCopy.termSelection.noCurrentTerm
      : workspaceCopy.termSelection.noAnySelection}
    historyCalendarSemesterId={signedData.overview?.calendar?.calendarSemesterPicker?.at(-1)?.id ?? null}
    showHistoryActions={signedData.overview?.hasAnySelection === true}
  />

  <OverviewSection
    href={workspaceTabHref("todos")}
    title={workspaceCopy.todos.title}
  >
    <p class="text-muted-foreground text-sm">
      {formatMessage(workspaceCopy.todos.pending, {
        count: pendingTodosCount,
      })}
    </p>
  </OverviewSection>
</div>
