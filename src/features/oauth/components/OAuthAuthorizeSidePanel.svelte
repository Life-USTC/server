<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";

export let appName: string;
</script>

<div class="flex min-w-0 items-center gap-3 rounded-md border border-base-300 bg-base-200/50 p-3">
  <img
    class="size-11 rounded-md border border-base-300 bg-base-100"
    src="/images/icon.png"
    alt="Life@USTC"
  />
  <div class="min-w-0">
    <Badge class="w-fit" variant="secondary">OAuth</Badge>
    <p class="mt-1 truncate font-medium text-sm">{appName}</p>
  </div>
</div>
