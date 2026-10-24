<script lang="ts">
import Plus from "@lucide/svelte/icons/plus";
import { onMount } from "svelte";
import { toolbarControlClass } from "#lib/components/toolbar-control.js";
import { Button } from "#lib/components/ui/button/index.js";
import { cn } from "#lib/utils.js";

export let homeworksCopy: Record<string, string>;
export let openCreateHomeworkDialog: () => void;
let ready = false;
onMount(() => {
  ready = true;
});
</script>

<div class="flex justify-end">
  <Button
    aria-label={homeworksCopy.addButton}
    class={cn(toolbarControlClass, "w-11 md:w-auto md:min-w-28")}
    data-testid="workspace-homeworks-add"
    type="button"
    disabled={!ready}
    onclick={openCreateHomeworkDialog}
  >
    <Plus class="md:hidden" data-icon="inline-start" />
    <span class="hidden md:inline">{homeworksCopy.addButton}</span>
  </Button>
</div>
