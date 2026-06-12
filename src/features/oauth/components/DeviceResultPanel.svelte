<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import type { DeviceCopy } from "./device-component-types";

export let copy: DeviceCopy;
export let result: "approved" | "denied";
</script>

<div class="grid gap-4 text-center">
  <Badge class="mx-auto" variant={result === "approved" ? "default" : "outline"}>
    {result === "approved" ? copy.deviceApprovedBadge : copy.deviceDeniedBadge}
  </Badge>
  <div>
    <h2 class="font-semibold text-2xl tracking-normal">
      {result === "approved" ? copy.deviceApprovedTitle : copy.deviceDeniedTitle}
    </h2>
    <p class="mt-2 text-base-content/60">
      {result === "approved"
        ? copy.deviceApprovedDescription
        : copy.deviceDeniedDescription}
    </p>
  </div>
</div>
