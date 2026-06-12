<script lang="ts">
export let loadingLabel: string;
</script>

<div
  class="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-primary/10"
  aria-hidden="true"
>
  <div class="h-full w-1/3 bg-primary shadow-[0_0_10px_currentColor]" style="animation: route-loading-bar 1.15s ease-in-out infinite;"></div>
</div>
<div class="sr-only" role="status">{loadingLabel}</div>
