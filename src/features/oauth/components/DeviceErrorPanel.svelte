<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";
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
  <Alert>
    <div class="grid gap-1">
      <h2 class="font-semibold text-xl text-error">{title}</h2>
      <p class="text-base-content/60">{errorMessage()}</p>
    </div>
  </Alert>
  <Button href="/oauth/device" variant="outline">{copy.deviceTryAgain}</Button>
</div>
