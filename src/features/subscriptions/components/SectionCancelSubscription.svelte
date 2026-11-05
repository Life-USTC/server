<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import { onDestroy } from "svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import { enhance, type SubmitFunction } from "$app/forms";
import { page } from "$app/state";
import { createSubscriptionConfirmationAction } from "../lib/subscription-confirmation-action";
import SubscriptionCancelDialog from "./SubscriptionCancelDialog.svelte";

let {
  name,
  label,
  pending,
  stretched = false,
  readOnlyReason,
  action,
}: {
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
const copy = $derived(
  getWorkspacePageCopy(page.data.locale === "en-us" ? "en-us" : "zh-cn")
    .subscriptions,
);
</script>
<form bind:this={form} class={stretched ? "w-full" : undefined} method="POST" action="?/unsubscribe" use:enhance={confirmation.submit}>
  <Button class={stretched ? "w-full" : undefined} variant="outline" type="button" disabled={Boolean(readOnlyReason) || pending} title={readOnlyReason} aria-haspopup="dialog" onclick={() => { open = true; }}>
    <CheckCircleIcon data-icon="inline-start" />{label}
  </Button>
</form>
<SubscriptionCancelDialog bind:open {name} {copy} onconfirm={() => confirmation.confirm(form)} />

