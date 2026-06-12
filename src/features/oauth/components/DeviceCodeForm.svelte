<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import type { DeviceCopy } from "./device-component-types";

export let code: string;
export let copy: DeviceCopy;
</script>

<header class="text-center">
  <Badge class="mb-3" variant="ghost">{copy.deviceTitle}</Badge>
  <h2 class="font-semibold text-2xl tracking-normal">{copy.deviceTitle}</h2>
  <p class="mt-2 text-base-content/60">{copy.deviceCodeHint}</p>
</header>

<form method="GET" action="/oauth/device" class="grid gap-4">
  <input type="hidden" name="step" value="approve" />
  <label class="grid gap-2">
    <span class="font-medium text-sm">{copy.deviceCodeLabel}</span>
    <Input
      id="code"
      autocomplete="off"
      class="h-11 text-center font-mono text-lg tracking-widest"
      name="code"
      placeholder="XXXX-XXXX"
      required
      type="text"
      value={code}
    />
  </label>
  <Button type="submit">{copy.deviceVerify}</Button>
</form>
