<script lang="ts">
import CheckCircle from "@lucide/svelte/icons/check-circle";
import ShieldAlert from "@lucide/svelte/icons/shield-alert";
import { enhance } from "$app/forms";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
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
  <p class="mt-2 break-words text-muted-foreground">
    {clientRequestParts[0] ?? ""}<strong>{approvalRequest.clientName}</strong>{clientRequestParts[1] ?? ""}
  </p>
</header>

{#if approvalRequest.scopes.length > 0}
  <Alert.Root>
    <ShieldAlert />
    <Alert.Title>{copy.deviceRequestedPermissions}</Alert.Title>
    <Alert.Description class="mt-2 flex flex-wrap gap-2 text-balance">
      {#each approvalRequest.scopes as scope}
        <Badge class="max-w-full whitespace-normal break-all font-mono text-left" variant="outline">{scope}</Badge>
      {/each}
    </Alert.Description>
  </Alert.Root>
{/if}

{#if approvalRequest.resources.length > 0}
  <Alert.Root>
    <ShieldAlert />
    <Alert.Title>{copy.deviceRequestedResources}</Alert.Title>
    <Alert.Description class="mt-2 flex flex-wrap gap-2 text-balance">
      {#each approvalRequest.resources as resource}
        <Badge class="max-w-full whitespace-normal break-all font-mono text-left" variant="outline">
          {resource}
        </Badge>
      {/each}
    </Alert.Description>
  </Alert.Root>
{/if}

<div class="grid grid-cols-2 gap-3">
  <form method="POST" action="?/deny" use:enhance={deviceDecisionAction("deny")}>
    <input type="hidden" name="userCode" value={approvalRequest.userCode} />
    <Button class="w-full" disabled={Boolean(pendingDecision)} type="submit" variant="outline">
      {#if pendingDecision === "deny"}<Spinner data-icon="inline-start" />{/if}
      {copy.deviceDeny}
    </Button>
  </form>
  <form method="POST" action="?/approve" use:enhance={deviceDecisionAction("approve")}>
    <input type="hidden" name="userCode" value={approvalRequest.userCode} />
    <Button class="w-full" disabled={Boolean(pendingDecision)} type="submit">
      {#if pendingDecision === "approve"}
        <Spinner data-icon="inline-start" />
      {:else}
        <CheckCircle data-icon="inline-start" />
      {/if}
      {copy.deviceApprove}
    </Button>
  </form>
</div>
