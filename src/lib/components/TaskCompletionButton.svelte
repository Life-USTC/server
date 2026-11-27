<script lang="ts">
import CheckCircle from "@lucide/svelte/icons/check-circle";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import TableIconButton from "./TableIconButton.svelte";
import { Button } from "./ui/button/index.js";
import { Spinner } from "./ui/spinner/index.js";

let {
  completed,
  saving,
  savingLabel,
  label,
  readOnlyReason,
  onclick,
  iconOnly = false,
  class: className,
}: {
  completed: boolean;
  saving?: boolean;
  savingLabel: string;
  label: string;
  readOnlyReason?: string | null;
  onclick: () => void;
  iconOnly?: boolean;
  class?: string;
} = $props();
const Icon = $derived(saving ? Spinner : completed ? RefreshCw : CheckCircle);
const text = $derived(saving ? savingLabel : label);
const disabled = $derived(Boolean(readOnlyReason || saving));
</script>

{#if iconOnly}
  <TableIconButton label={text} {disabled} variant={completed ? "secondary" : "default"} {onclick}>
    <Icon data-icon="inline-start" />
  </TableIconButton>
{:else}
  <Button class={className} {disabled} title={readOnlyReason ?? undefined} type="button" {onclick}>
    <Icon data-icon="inline-start" />
    {text}
  </Button>
{/if}
