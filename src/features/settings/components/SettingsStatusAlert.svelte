<script lang="ts">
import * as Alert from "$lib/components/ui/alert/index.js";
import type { SettingsCopy } from "./settings-component-types";

export let copy: SettingsCopy;
export let statusMessage: string | null | undefined;

$: isSuccessStatus =
  statusMessage === "Success" ||
  statusMessage === "AccountDisconnected" ||
  statusMessage === "AuthorizationRevoked" ||
  statusMessage === "CalendarTokenRotated";
$: statusTitle = copy.profile.updateError;
$: statusDescription = statusMessage;
</script>

{#if statusMessage && !isSuccessStatus}
  <Alert.Root variant="destructive">
    <Alert.Title role="heading" aria-level={2}>{statusTitle}</Alert.Title>
    <Alert.Description>{statusDescription}</Alert.Description>
  </Alert.Root>
{/if}
