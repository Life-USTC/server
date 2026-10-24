<script lang="ts">
import Plus from "@lucide/svelte/icons/plus";
import { onMount } from "svelte";
import { toolbarControlClass } from "#lib/components/toolbar-control.js";
import { Button } from "#lib/components/ui/button/index.js";
import { cn } from "#lib/utils.js";
import type { WorkspaceTodosCopy } from "@/features/workspace/lib/workspace-controller-types";

export let createTodoError: string;
export let showCreateTodo: boolean;
export let todosCopy: WorkspaceTodosCopy;
export let readOnlyReason: string | undefined = undefined;
let ready = false;
onMount(() => {
  ready = true;
});
</script>

<div class="flex justify-end">
  <Button
    aria-label={String(todosCopy.addButton)}
    class={cn(toolbarControlClass, "w-11 md:w-auto md:min-w-28")}
    data-testid="workspace-todos-add"
    type="button"
    disabled={!ready || Boolean(readOnlyReason)}
    title={readOnlyReason}
    onclick={() => { createTodoError = ""; showCreateTodo = true; }}
  >
    <Plus class="md:hidden" data-icon="inline-start" />
    <span class="hidden md:inline">{todosCopy.addButton}</span>
  </Button>
</div>
