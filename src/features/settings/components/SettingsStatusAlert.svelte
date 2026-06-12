<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";
import type { SettingsCopy } from "./settings-component-types";

export let copy: SettingsCopy;
export let statusMessage: string | null | undefined;

$: isSuccessStatus =
  statusMessage === "Success" || statusMessage === "AccountDisconnected";
$: statusTitle = isSuccessStatus
  ? statusMessage === "AccountDisconnected"
    ? copy.profile.disconnectSuccess
    : copy.profile.updateSuccess
  : copy.profile.updateError;
$: statusDescription = isSuccessStatus
  ? statusMessage === "AccountDisconnected"
    ? copy.profile.disconnectSuccessDescription
    : copy.profile.updateSuccessDescription
  : statusMessage;
</script>

{#if statusMessage}
  <Alert
    class={isSuccessStatus ? "border-success/40 bg-success/10" : ""}
    variant={isSuccessStatus ? "default" : "destructive"}
  >
    <div>
      <h2 class="font-semibold">{statusTitle}</h2>
      <span>{statusDescription}</span>
    </div>
  </Alert>
{/if}
