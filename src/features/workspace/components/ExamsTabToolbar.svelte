<script lang="ts">
import MoreHorizontal from "@lucide/svelte/icons/more-horizontal";
import { Button } from "$lib/components/ui/button/index.js";
import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
import type { WorkspaceCardView } from "@/features/workspace/lib/view-preferences";
import type { WorkspaceCopy } from "@/features/workspace/lib/workspace-controller-types";
import WorkspaceTaskToolbar from "./WorkspaceTaskToolbar.svelte";
import type { WorkspaceExamFilter } from "./workspace-exam-component-types";

export let workspaceCopy: WorkspaceCopy;
export let mobileView: WorkspaceCardView;
export let onMobileViewChange: (value: WorkspaceCardView) => void;
export let examFilter: WorkspaceExamFilter;
export let onExamFilterChange: (value: WorkspaceExamFilter) => void;
</script>

<div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 md:block">
<WorkspaceTaskToolbar
  ariaLabel={workspaceCopy.nav.exams.title}
  filter={examFilter}
  onFilterChange={onExamFilterChange}
  filterIncompleteLabel={workspaceCopy.nav.exams.filterIncomplete}
  filterCompletedLabel={workspaceCopy.nav.exams.filterCompleted}
  filterAllLabel={workspaceCopy.nav.exams.filterAll}
/>

  <div class="md:hidden">
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            aria-label={workspaceCopy.nav.exams.viewMode}
            class="size-11"
            data-testid="workspace-exams-view-menu"
            size="icon"
            type="button"
            variant="outline"
          >
            <MoreHorizontal data-icon="inline-start" />
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" preventScroll={false}>
        <DropdownMenu.RadioGroup value={mobileView} onValueChange={(value) => {
          if (value === "cards" || value === "list") onMobileViewChange(value);
        }}>
          <DropdownMenu.RadioItem value="cards" class="min-h-11">
            {workspaceCopy.nav.exams.cardView}
          </DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem value="list" class="min-h-11">
            {workspaceCopy.nav.exams.listView}
          </DropdownMenu.RadioItem>
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
</div>
