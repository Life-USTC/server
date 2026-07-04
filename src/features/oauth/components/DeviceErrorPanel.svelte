<script lang="ts">
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import type { DeviceCopy } from "./device-component-types";

export let copy: DeviceCopy;
export let reason: string | undefined;
export let status: string | undefined;
export let title: string;

function errorMessage() {
  if (reason === "missing_code") return copy.deviceMissingCode;
  if (reason === "invalid_or_expired") return copy.deviceInvalidOrExpired;
  if (reason === "not_found") return copy.deviceCodeNotFound;
  if (reason === "expired") return copy.deviceCodeExpired;
  if (reason === "used")
    return copy.deviceCodeUsed.replace("{status}", status ?? "used");
  return copy.deviceUnknownError;
}
</script>

<div class="grid gap-4 text-center">
  <Alert.Root variant="destructive">
    <Alert.Title role="heading" aria-level={2}>{title}</Alert.Title>
    <Alert.Description>{errorMessage()}</Alert.Description>
  </Alert.Root>
  <Button href="/oauth/device" variant="outline">{copy.deviceTryAgain}</Button>
</div>
