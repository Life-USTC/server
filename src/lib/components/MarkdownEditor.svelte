<script lang="ts">
import type { PluggableList } from "unified";
import MarkdownPreview from "$lib/components/MarkdownPreview.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as InputGroup from "$lib/components/ui/input-group/index.js";
import * as Tabs from "$lib/components/ui/tabs/index.js";

export let disabled = false;
export let guideHref = "/guides/markdown-support";
export let guideLabel = "";
export let isDragActive = false;
export let modeLabel = "";
export let name: string | undefined = undefined;
export let placeholder = "";
export let previewEmptyLabel = "";
export let remarkPlugins: PluggableList = [];
export let rows = 6;
export let tabPreviewLabel = "";
export let tabWriteLabel = "";
export let value = "";
let activeTab: "write" | "preview" = "write";
let className = "";

export { className as class };

function stringRestProp(name: string) {
  const value = ($$restProps as Record<string, unknown>)[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

$: labelledBy = stringRestProp("aria-labelledby");
$: label = stringRestProp("aria-label");

function setActiveTab(value: string) {
  if (value === "write" || value === "preview") {
    activeTab = value;
  }
}
</script>

<div
  aria-label={labelledBy ? undefined : label}
  aria-labelledby={labelledBy}
  class={`grid gap-3 ${className}`}
  data-slot="markdown-editor"
  role={labelledBy || label ? "group" : undefined}
>
  {#if name}
    <input type="hidden" {name} {value} />
  {/if}

  <Tabs.Root
    value={activeTab}
    onValueChange={setActiveTab}
    class="gap-3"
  >
    <Tabs.List aria-label={modeLabel || undefined}>
      <Tabs.Trigger value="write">{tabWriteLabel}</Tabs.Trigger>
      <Tabs.Trigger value="preview">{tabPreviewLabel}</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="write" class="m-0">
      <InputGroup.Root
        class="h-auto min-h-32 data-[drag-active=true]:border-primary data-[drag-active=true]:bg-primary/5"
        data-drag-active={isDragActive}
      >
        <InputGroup.Textarea
          aria-label={labelledBy ? undefined : label}
          aria-labelledby={labelledBy}
          class="min-h-32 resize-y"
          bind:value
          {disabled}
          {placeholder}
          {rows}
          {...$$restProps}
        ></InputGroup.Textarea>
      </InputGroup.Root>
    </Tabs.Content>
    <Tabs.Content value="preview" class="m-0 min-h-32 rounded-lg border bg-background p-3">
      {#if value.trim()}
        <MarkdownPreview content={value} {remarkPlugins} />
      {:else}
        <p class="text-center text-base-content/50 text-sm italic">
          {previewEmptyLabel}
        </p>
      {/if}
    </Tabs.Content>
  </Tabs.Root>

  {#if guideLabel}
    <div class="flex justify-end">
      <Button href={guideHref} size="sm" variant="ghost">{guideLabel}</Button>
    </div>
  {/if}
</div>
