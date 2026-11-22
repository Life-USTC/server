<script lang="ts">
import Plus from "@lucide/svelte/icons/plus";
import { onMount } from "svelte";
import { Button } from "#lib/components/ui/button/index.js";

export let canWriteShared = false;
export let readOnlyReason: string | null | undefined = null;
export let homeworksCopy: Record<string, string>;
export let openCreateHomeworkDialog: () => void;
let ready = false;
onMount(() => {
  ready = true;
});
</script>

<div class="compact-toolbar max-md:icon-action-row flex justify-end">
  <Button
    aria-label={homeworksCopy.addButton}
    data-testid="workspace-homeworks-add"
    type="button"
    disabled={!ready || !canWriteShared || Boolean(readOnlyReason)}
    title={readOnlyReason ?? undefined}
    onclick={openCreateHomeworkDialog}
  >
    <Plus class="md:hidden" />
    <span class="hidden md:inline">{homeworksCopy.addButton}</span>
  </Button>
</div>
