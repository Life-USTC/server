<script lang="ts">
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Dialog from "#lib/components/ui/dialog/index.js";

let {
  src,
  alt,
  title,
  class: className,
  loading = "lazy",
  preview = false,
  copy,
}: {
  src: string;
  alt: string;
  title?: string;
  class?: string;
  loading?: "lazy" | "eager";
  preview?: boolean;
  copy: { title: string; description: string; retry: string; original: string };
} = $props();
let failed = $state(false);
let previewFailed = $state(false);
let attempt = $state(0);
const imageSrc = $derived(attempt === 0 ? src : `${src}?retry=${attempt}`);
function retry() {
  failed = false;
  previewFailed = false;
  attempt += 1;
}
</script>

{#snippet failure()}
  <Alert.Root>
    <Alert.Title>{copy.title}</Alert.Title>
    <Alert.Description>{copy.description}</Alert.Description>
    <div class="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onclick={retry}>{copy.retry}</Button>
      <Button href={src} target="_blank" rel="noreferrer" variant="link" size="sm">{copy.original}</Button>
    </div>
  </Alert.Root>
{/snippet}

{#if failed}
  {@render failure()}
{:else if preview}
  <Dialog.Root>
    <Dialog.Trigger class="block w-full cursor-zoom-in" aria-label={alt}>
      <img {alt} src={imageSrc} class={className} {loading} decoding="async" onerror={() => { failed = true; }} />
    </Dialog.Trigger>
    <Dialog.Content class="sm:max-w-[calc(100%-2rem)]">
      <Dialog.Header class="pe-8">
        <Dialog.Title>{title ?? alt}</Dialog.Title>
        <Dialog.Description>{alt}</Dialog.Description>
      </Dialog.Header>
      {#if previewFailed}
        {@render failure()}
      {:else}
        <a href={src} target="_blank" rel="noreferrer" class="block min-w-0 cursor-zoom-in">
          <img {alt} src={imageSrc} class="h-auto w-full" onerror={() => { previewFailed = true; }} />
        </a>
      {/if}
    </Dialog.Content>
  </Dialog.Root>
{:else}
  <img {alt} src={imageSrc} class={className} {loading} decoding="async" onerror={() => { failed = true; }} />
{/if}
