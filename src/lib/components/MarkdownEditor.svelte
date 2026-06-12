<script lang="ts">
import MarkdownPreview from "$lib/components/MarkdownPreview.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Tabs from "$lib/components/ui/tabs/index.js";
import { Textarea } from "$lib/components/ui/textarea/index.js";

export let disabled = false;
export let guideHref = "/guides/markdown-support";
export let guideLabel = "";
export let isDragActive = false;
export let modeLabel = "";
export let name: string | undefined = undefined;
export let placeholder = "";
export let previewEmptyLabel = "";
export let rows = 6;
export let tabPreviewLabel = "";
export let tabWriteLabel = "";
export let value = "";
let activeTab: "write" | "preview" = "write";
let className = "";

export { className as class };
</script>

<div class={`grid gap-3 ${className}`} data-slot="markdown-editor">
  {#if name}
    <input type="hidden" {name} {value} />
  {/if}

  <Tabs.List aria-label={modeLabel}>
    <Tabs.Button
      selected={activeTab === "write"}
      onclick={() => {
        activeTab = "write";
      }}
    >
      {tabWriteLabel}
    </Tabs.Button>
    <Tabs.Button
      selected={activeTab === "preview"}
      onclick={() => {
        activeTab = "preview";
      }}
    >
      {tabPreviewLabel}
    </Tabs.Button>
  </Tabs.List>

  <div
    class={`min-h-32 rounded-md border border-base-300 bg-base-100 transition-colors focus-within:ring-2 focus-within:ring-primary/30 ${isDragActive ? "border-primary bg-primary/5" : ""}`}
  >
    {#if activeTab === "write"}
      <Textarea
        class="min-h-0 resize-y border-0 bg-transparent shadow-none focus-visible:ring-0"
        bind:value
        {disabled}
        {placeholder}
        {rows}
        {...$$restProps}
      ></Textarea>
    {:else}
      <div class="min-h-32 p-3">
        {#if value.trim()}
          <MarkdownPreview content={value} />
        {:else}
          <p class="text-center text-base-content/50 text-sm italic">
            {previewEmptyLabel}
          </p>
        {/if}
      </div>
    {/if}
  </div>

  {#if guideLabel}
    <div class="flex justify-end">
      <Button href={guideHref} size="sm" variant="ghost">{guideLabel}</Button>
    </div>
  {/if}
</div>
