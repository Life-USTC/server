<script lang="ts">
import Plus from "@lucide/svelte/icons/plus";
import { onMount } from "svelte";
import { Button } from "#lib/components/ui/button/index.js";
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

<div class="compact-toolbar flex justify-end">
  <Button
    class="max-md:icon-action"
    aria-label={String(todosCopy.addButton)}
    data-testid="workspace-todos-add"
    type="button"
    disabled={!ready || Boolean(readOnlyReason)}
    title={readOnlyReason}
    onclick={() => { createTodoError = ""; showCreateTodo = true; }}
  >
    <Plus class="md:hidden" />
    <span class="hidden md:inline">{todosCopy.addButton}</span>
  </Button>
</div>
