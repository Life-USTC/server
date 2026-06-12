<script lang="ts">
import ShieldAlert from "$lib/components/icons/shield-alert.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";

export let appName: string;
export let sideNoteLabel: string;
</script>

<div class="grid content-between gap-8 border-base-300 border-b bg-base-200/35 p-6 lg:border-r lg:border-b-0">
  <div class="grid gap-5">
    <div class="flex items-center gap-3">
      <img class="h-12 w-12 rounded-md border border-base-300 bg-base-100" src="/images/icon.png" alt="Life@USTC" />
      <div>
        <Badge class="w-fit" variant="secondary">OAuth</Badge>
        <p class="mt-1 break-words text-base-content/60 text-sm leading-6">{appName}</p>
      </div>
    </div>
  </div>

  <div class="rounded-md border border-base-300 bg-base-100 p-3 text-sm">
    <div class="flex items-start gap-3">
      <ShieldAlert class="mt-0.5 text-primary" />
      <p class="min-w-0 break-words text-base-content/60 leading-6">{sideNoteLabel}</p>
    </div>
  </div>
</div>
