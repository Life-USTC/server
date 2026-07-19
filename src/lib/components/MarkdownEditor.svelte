<script lang="ts">
import type { ComponentProps } from "svelte";
import type { PluggableList } from "unified";
import { Button } from "$lib/components/ui/button/index.js";
import * as InputGroup from "$lib/components/ui/input-group/index.js";
import * as Tabs from "$lib/components/ui/tabs/index.js";

type MarkdownEditorProps = Omit<
  ComponentProps<typeof InputGroup.Textarea>,
  "value"
> & {
  compact?: boolean;
  guideHref?: string;
  guideLabel?: string;
  isDragActive?: boolean;
  modeLabel?: string;
  name?: string;
  previewEmptyLabel?: string;
  remarkPlugins?: PluggableList;
  tabPreviewLabel?: string;
  tabWriteLabel?: string;
  value?: string;
};

let {
  compact: _compact = false,
  disabled = false,
  guideHref = "/guides/markdown-support",
  guideLabel = "",
  isDragActive = false,
  modeLabel = "",
  name = undefined,
  placeholder = "",
  previewEmptyLabel = "",
  remarkPlugins = [],
  rows = 6,
  tabPreviewLabel = "",
  tabWriteLabel = "",
  value = $bindable(""),
  class: className = "",
  ...restProps
}: MarkdownEditorProps = $props();

let activeTab = $state<"write" | "preview">("write");

function stringRestProp(name: string) {
  const propValue = (restProps as Record<string, unknown>)[name];
  return typeof propValue === "string" && propValue.length > 0
    ? propValue
    : undefined;
}

let labelledBy = $derived(stringRestProp("aria-labelledby"));
let label = $derived(stringRestProp("aria-label"));

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
      <div
        class="rounded-md border border-transparent transition-colors data-[drag-active=true]:border-primary data-[drag-active=true]:bg-primary/5"
        data-drag-active={isDragActive}
      >
        <InputGroup.Root class="h-auto min-h-32">
          <InputGroup.Textarea
            aria-label={labelledBy ? undefined : label}
            aria-labelledby={labelledBy}
            class="min-h-32 resize-y"
            bind:value
            {disabled}
            {placeholder}
            {rows}
            {...restProps}
          ></InputGroup.Textarea>
        </InputGroup.Root>
      </div>
    </Tabs.Content>
    <Tabs.Content value="preview" class="m-0 min-h-32 p-3">
      {#if activeTab === "preview"}
        {#await import("$lib/components/MarkdownPreview.svelte") then previewModule}
          {@const Preview = previewModule.default}
          <Preview content={value} emptyLabel={previewEmptyLabel} {remarkPlugins} />
        {/await}
      {/if}
    </Tabs.Content>
  </Tabs.Root>

  {#if guideLabel}
    <div class="flex justify-end">
      <Button href={guideHref} size="sm" variant="ghost">{guideLabel}</Button>
    </div>
  {/if}
</div>
