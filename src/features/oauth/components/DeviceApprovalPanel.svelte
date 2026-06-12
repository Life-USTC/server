<script lang="ts">
import { enhance } from "$app/forms";
import CheckCircle from "$lib/components/icons/check-circle.svelte";
import RefreshCw from "$lib/components/icons/refresh-cw.svelte";
import ShieldAlert from "$lib/components/icons/shield-alert.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import type {
  DeviceApprovalRequest,
  DeviceCopy,
  DeviceDecisionAction,
} from "./device-component-types";

export let approvalRequest: DeviceApprovalRequest;
export let copy: DeviceCopy;
export let deviceDecisionAction: DeviceDecisionAction;
export let pendingDecision: "approve" | "deny" | null;

$: clientRequestParts = copy.deviceClientRequest.split("{app}");
</script>

<header class="text-center">
  <Badge class="mb-3" variant="ghost">{copy.deviceTitle}</Badge>
  <h2 class="font-semibold text-2xl tracking-normal">{copy.deviceApproveTitle}</h2>
  <p class="mt-2 break-words text-base-content/60">
    {clientRequestParts[0] ?? ""}<strong>{approvalRequest.clientName}</strong>{clientRequestParts[1] ?? ""}
  </p>
</header>

{#if approvalRequest.scopes.length > 0}
  <section class="min-w-0 rounded-md border border-base-300 bg-base-200/50 p-4">
    <h2 class="flex min-w-0 items-center gap-2 font-medium text-sm">
      <ShieldAlert />
      <span class="min-w-0 break-words">{copy.deviceRequestedPermissions}</span>
    </h2>
    <div class="mt-3 flex flex-wrap gap-2">
      {#each approvalRequest.scopes as scope}
        <Badge class="max-w-full whitespace-normal break-all font-mono text-left" variant="outline">{scope}</Badge>
      {/each}
    </div>
  </section>
{/if}

<div class="grid grid-cols-2 gap-3">
  <form method="POST" action="?/deny" use:enhance={deviceDecisionAction("deny")}>
    <input type="hidden" name="userCode" value={approvalRequest.userCode} />
    <Button class="w-full" disabled={Boolean(pendingDecision)} type="submit" variant="outline">
      {#if pendingDecision === "deny"}<RefreshCw class="animate-spin" />{/if}
      {copy.deviceDeny}
    </Button>
  </form>
  <form method="POST" action="?/approve" use:enhance={deviceDecisionAction("approve")}>
    <input type="hidden" name="userCode" value={approvalRequest.userCode} />
    <Button class="w-full" disabled={Boolean(pendingDecision)} type="submit">
      {#if pendingDecision === "approve"}
        <RefreshCw class="animate-spin" />
      {:else}
        <CheckCircle />
      {/if}
      {copy.deviceApprove}
    </Button>
  </form>
</div>
