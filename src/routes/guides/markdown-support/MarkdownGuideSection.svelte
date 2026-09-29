<script lang="ts">
import MarkdownPreview from "$lib/components/MarkdownPreview.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";

export let index: number;
export let previewTitle: string;
export let section: {
  code: string;
  description: string;
  title: string;
};
</script>

<section class="grid gap-6 lg:grid-cols-2">
  <div class="grid min-w-0 gap-3">
    <div class="grid gap-1">
      <div class="flex items-center gap-2">
        <Badge variant="outline">{String(index + 1).padStart(2, "0")}</Badge>
        <h2 class="font-medium text-sm">{section.title}</h2>
      </div>
      <p class="text-muted-foreground text-sm">{section.description}</p>
    </div>
    <pre class="overflow-x-auto wrap-anywhere whitespace-pre-wrap rounded-md border border-border bg-muted p-4 font-mono text-sm"><code>{section.code}</code></pre>
  </div>

  <div class="grid min-w-0 gap-3">
    <h2 class="font-medium text-sm">{previewTitle}</h2>
    <div class="rounded-md border border-border bg-background p-5">
      <MarkdownPreview content={section.code} />
    </div>
  </div>
</section>
