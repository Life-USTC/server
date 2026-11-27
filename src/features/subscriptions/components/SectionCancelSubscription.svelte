<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import { onDestroy } from "svelte";
import { Button } from "#lib/components/ui/button/index.js";
import type { SectionSubscriptionCopy } from "@/features/section-detail/server/section-detail-page-copy";
import { enhance, type SubmitFunction } from "$app/forms";
import { createSubscriptionConfirmationAction } from "../lib/subscription-confirmation-action";
import SubscriptionCancelDialog from "./SubscriptionCancelDialog.svelte";

let {
  copy,
  name,
  label,
  pending,
  stretched = false,
  readOnlyReason,
  action,
}: {
  copy: SectionSubscriptionCopy;
  name: string;
  label: string;
  pending: boolean;
  stretched?: boolean;
  readOnlyReason?: string;
  action: SubmitFunction;
} = $props();
let open = $state(false);
let form: HTMLFormElement;
const confirmation = createSubscriptionConfirmationAction(() => action);
onDestroy(() => confirmation.dispose());
</script>
<form bind:this={form} class={stretched ? "w-full" : undefined} method="POST" action="?/unsubscribe" use:enhance={confirmation.submit}>
  <Button icon={CheckCircleIcon} class={stretched ? "w-full" : undefined} variant="outline" disabled={Boolean(readOnlyReason) || pending} title={readOnlyReason} aria-haspopup="dialog" onclick={() => { open = true; }}>{label}
  </Button>
</form>
<SubscriptionCancelDialog bind:open {name} {copy} onconfirm={() => confirmation.confirm(form)} />

