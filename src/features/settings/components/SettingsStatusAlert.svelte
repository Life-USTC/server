<script lang="ts">
import * as Alert from "$lib/components/ui/alert/index.js";
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
  <Alert.Root
    variant={isSuccessStatus ? "default" : "destructive"}
  >
    <Alert.Title role="heading" aria-level={2}>{statusTitle}</Alert.Title>
    <Alert.Description>{statusDescription}</Alert.Description>
  </Alert.Root>
{/if}
