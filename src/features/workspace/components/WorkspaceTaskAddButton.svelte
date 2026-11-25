<script lang="ts">
import Plus from "@lucide/svelte/icons/plus";
import { onMount } from "svelte";
import { Button } from "#lib/components/ui/button/index.js";

export let label: string;
export let testId: string;
export let disabled = false;
export let readOnlyReason: string | null | undefined = undefined;
export let onclick: () => void;
let ready = false;
onMount(() => {
  ready = true;
});
</script>

<div class="compact-toolbar flex justify-end">
  <Button
    class="max-md:icon-action"
    aria-label={label}
    data-testid={testId}
    disabled={!ready || disabled || Boolean(readOnlyReason)}
    title={readOnlyReason ?? undefined}
    {onclick}
  >
    <Plus class="md:hidden" />
    <span class="hidden md:inline">{label}</span>
  </Button>
</div>
