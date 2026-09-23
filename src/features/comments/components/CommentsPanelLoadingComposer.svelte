<script lang="ts">
import { Skeleton } from "$lib/components/ui/skeleton/index.js";
</script>

<div class="grid gap-4">
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div class="grid gap-2">
      <Skeleton class="h-5 w-32" />
      <Skeleton class="h-4 w-56 max-w-full" />
    </div>
    <Skeleton class="h-8 w-24" />
  </div>
  <div class="grid gap-4">
    <Skeleton class="h-36 w-full" />
    <div class="flex justify-end gap-2">
      <Skeleton class="h-8 w-24" />
      <Skeleton class="h-8 w-20" />
    </div>
  </div>
</div>
