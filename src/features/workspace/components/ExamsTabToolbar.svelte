<script lang="ts">
import MoreHorizontal from "@lucide/svelte/icons/more-horizontal";
import { collectionCompactClass } from "#lib/components/collection-responsive-breakpoint.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as DropdownMenu from "#lib/components/ui/dropdown-menu/index.js";
import type { WorkspaceCopy } from "@/features/workspace/lib/workspace-controller-types";
import type { WorkspaceCardView } from "./workspace-exam-component-types";

export let workspaceCopy: WorkspaceCopy;
export let mobileView: WorkspaceCardView;
export let onMobileViewChange: (value: WorkspaceCardView) => void;
</script>

  <div class={collectionCompactClass}>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet render({ props })}
          <Button
            {...props}
            icon={MoreHorizontal}
            aria-label={workspaceCopy.nav.exams.viewMode}
            class="icon-action"
            data-testid="workspace-exams-view-menu"
            size="icon"
            type="button"
            variant="outline"
          />
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
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
