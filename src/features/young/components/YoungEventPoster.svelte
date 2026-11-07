<script lang="ts">
import { Button } from "#lib/components/ui/button/index.js";
import { Skeleton } from "#lib/components/ui/skeleton/index.js";

let {
  src,
  name,
  label,
  failedLabel,
  retryLabel,
}: {
  src: string;
  name: string;
  label: string;
  failedLabel: string;
  retryLabel: string;
} = $props();
let loaded = $state(false);
let failed = $state(false);
let attempt = $state(0);
$effect(() => {
  src;
  loaded = false;
  failed = false;
  attempt = 0;
});
function retry() {
  loaded = false;
  failed = false;
  attempt += 1;
}
</script>

<div class="relative aspect-[4/3] w-full max-w-[21.333rem] justify-self-center overflow-hidden rounded-lg bg-muted lg:max-w-none" data-testid="young-event-poster">
  {#if failed}
    <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-sm" role="alert">
      <p>{failedLabel}</p>
      <div class="flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="outline" onclick={retry}>{retryLabel}</Button>
        <Button size="sm" variant="ghost" href={src} target="_blank" rel="noreferrer noopener">{label}</Button>
      </div>
    </div>
  {:else}
    {#key `${src}:${attempt}`}
      <a class="absolute inset-0" href={src} rel="noreferrer noopener" target="_blank" aria-label={label}>
        <img alt={name} class="size-full object-contain" src={src} onload={() => loaded = true} onerror={() => failed = true} />
      </a>
    {/key}
    {#if !loaded}
      <div class="pointer-events-none absolute inset-0" aria-busy="true" aria-label={label}><Skeleton class="size-full rounded-none" /></div>
    {/if}
  {/if}
</div>
