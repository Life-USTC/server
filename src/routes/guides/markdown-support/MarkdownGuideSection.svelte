<script lang="ts">
import MarkdownPreview from "$lib/components/MarkdownPreview.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";

export let index: number;
export let previewTitle: string;
export let section: {
  code: string;
  description: string;
  title: string;
};
</script>

<section class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
  <Card.Root>
    <Card.Header>
      <div class="flex items-center gap-2">
        <Badge variant="outline">{String(index + 1).padStart(2, "0")}</Badge>
        <Card.Title>{section.title}</Card.Title>
      </div>
      <Card.Description>{section.description}</Card.Description>
    </Card.Header>
    <Card.Content>
      <pre class="overflow-x-auto rounded-md border border-base-300 bg-base-200 p-4 font-mono text-sm"><code>{section.code}</code></pre>
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title class="font-medium text-base-content/70 text-sm">{previewTitle}</Card.Title>
    </Card.Header>
    <Card.Content>
      <div class="rounded-md border border-base-300 bg-base-100 p-5 shadow-sm">
        <MarkdownPreview content={section.code} />
      </div>
    </Card.Content>
  </Card.Root>
</section>
