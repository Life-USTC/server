<script lang="ts">
import { collectionCompactClass } from "#lib/components/collection-responsive-breakpoint.js";
import MoreActionsMenu from "#lib/components/MoreActionsMenu.svelte";
import * as DropdownMenu from "#lib/components/ui/dropdown-menu/index.js";
import type { WorkspaceCopy } from "@/features/workspace/lib/workspace-controller-types";
import type { WorkspaceCardView } from "./workspace-exam-component-types";

export let workspaceCopy: WorkspaceCopy;
export let mobileView: WorkspaceCardView;
export let onMobileViewChange: (value: WorkspaceCardView) => void;
</script>

  <div class={collectionCompactClass}>
    <MoreActionsMenu label={workspaceCopy.nav.exams.viewMode} data-testid="workspace-exams-view-menu">
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
    </MoreActionsMenu>
  </div>
