<script lang="ts">
export let description: string;

$: stops = description
  .split(/\s*(?:->|→)\s*/u)
  .filter((stop) => stop.length > 0);
</script>

<span
  class="inline-flex min-w-0 max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-0.5"
  data-slot="bus-route-description"
>
  {#each stops as stop, index}
    <span class="whitespace-nowrap">
      {#if index > 0}→ {/if}{stop}
    </span>
  {/each}
</span>
