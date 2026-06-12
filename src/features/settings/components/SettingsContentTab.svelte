<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import type { SettingsCopy } from "./settings-component-types";

export let copy: SettingsCopy;
</script>

<Card.Root class="border-base-300 bg-base-100">
  <Card.Header>
    <Card.Title>{copy.settings.content.title}</Card.Title>
    <Card.Description>
      {copy.settings.content.description}
    </Card.Description>
  </Card.Header>
  <Card.Content class="grid gap-5">
    <Alert>
      <div class="grid gap-1">
        <h2 class="font-semibold">{copy.settings.content.emptyTitle}</h2>
        <p>{copy.settings.content.emptyDescription}</p>
      </div>
    </Alert>
    <div class="grid gap-3 sm:grid-cols-2">
      <a
        class="block min-w-0 rounded-md border border-base-300 bg-base-100 p-4 text-left no-underline shadow-sm transition hover:bg-base-200"
        href="/sections"
      >
        <span class="block min-w-0 max-w-full">
          <span class="block font-medium">
            {copy.settings.content.browseSections.title}
          </span>
          <span class="mt-1 block break-words text-base-content/60 text-sm [overflow-wrap:anywhere]">
            {copy.settings.content.browseSections.description}
          </span>
        </span>
      </a>
      <a
        class="block min-w-0 rounded-md border border-base-300 bg-base-100 p-4 text-left no-underline shadow-sm transition hover:bg-base-200"
        href="/guides/markdown-support"
      >
        <span class="block min-w-0 max-w-full">
          <span class="block font-medium">
            {copy.settings.content.commentGuide.title}
          </span>
          <span class="mt-1 block break-words text-base-content/60 text-sm [overflow-wrap:anywhere]">
            {copy.settings.content.commentGuide.description}
          </span>
        </span>
      </a>
    </div>
  </Card.Content>
</Card.Root>
