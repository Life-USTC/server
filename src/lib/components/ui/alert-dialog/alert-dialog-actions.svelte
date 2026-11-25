<script lang="ts">
import type { Component } from "svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { Spinner } from "#lib/components/ui/spinner/index.js";
import Cancel from "./alert-dialog-cancel.svelte";

let {
  cancelLabel, confirmLabel, pending = false, busy = false, confirmDisabled = false,
  icon: Icon, pendingLabel, onclick, secondaryCancel = false, destructive = true,
}: {
  cancelLabel: string;
  confirmLabel: string;
  pending?: boolean;
  busy?: boolean;
  icon?: Component<{ "data-icon"?: string }>;
  pendingLabel?: string;
  confirmDisabled?: boolean;
  onclick?: (event: MouseEvent) => void;
  secondaryCancel?: boolean;
  destructive?: boolean;
} = $props();
</script>

<div data-slot="alert-dialog-footer">
  <Cancel type="button" disabled={busy || pending} variant={secondaryCancel ? "secondary" : "outline"}>{cancelLabel}</Cancel>
  <Button type={onclick ? "button" : "submit"} variant={destructive ? "destructive" : "default"} disabled={busy || pending || confirmDisabled} {onclick}>
    {#if pending}<Spinner data-icon="inline-start" aria-label={pendingLabel} />{:else if Icon}<Icon data-icon="inline-start" />{/if}
    {pending && pendingLabel ? pendingLabel : confirmLabel}
  </Button>
</div>
