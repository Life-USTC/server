<script lang="ts">
import type { HomeworkStyleGuideCopy } from "@/features/homeworks/lib/homework-style-guide";
import * as Accordion from "$lib/components/ui/accordion/index.js";

export let copy: HomeworkStyleGuideCopy;
export let testIdPrefix: string;
</script>

<Accordion.Root type="single">
  <Accordion.Item class="rounded-md border px-3" value="homework-style-guide">
    <Accordion.Trigger
      class="py-3 hover:no-underline"
      data-testid={`${testIdPrefix}-style-guide-trigger`}
    >
      {copy.styleGuideTitle}
    </Accordion.Trigger>
    <Accordion.Content
      class="space-y-3 pb-3 text-muted-foreground"
      data-testid={`${testIdPrefix}-style-guide-content`}
    >
      <p>{copy.styleGuideTitleGuidance}</p>
      <ul class="ml-5 list-disc space-y-1">
        <li><code class="break-words">{copy.styleGuideNumberedPattern}</code></li>
        <li><code class="break-words">{copy.styleGuideTopicPattern}</code></li>
      </ul>
      <p>{copy.styleGuideAvoidChapter}</p>
      <p>{copy.styleGuideAvoidCourse}</p>
      <p>{copy.styleGuideDescriptionGuidance}</p>
      <pre
        class="max-w-full whitespace-pre-wrap break-words rounded-md bg-muted px-3 py-2 text-xs text-foreground"
      >{copy.styleGuideDescriptionTemplate}</pre>
      <p class="text-xs">{copy.styleGuideAdvisory}</p>
    </Accordion.Content>
  </Accordion.Item>
</Accordion.Root>
