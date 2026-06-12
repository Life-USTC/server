<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";

type SectionSearchHelpLabels = {
  close: string;
  searchHelpDescription: string;
  searchHelpExamples: Array<{
    description: string;
    example: string;
    syntax: string;
  }>;
  searchHelpTitle: string;
};

export let isSearchHelpOpen: boolean;
export let sectionLabels: SectionSearchHelpLabels;
</script>

<Dialog.Root
  aria-label="Section search help"
  bind:open={isSearchHelpOpen}
  class="max-w-2xl"
>
  <Dialog.Header>
    <Dialog.Title>{sectionLabels.searchHelpTitle}</Dialog.Title>
    <Dialog.Description>{sectionLabels.searchHelpDescription}</Dialog.Description>
  </Dialog.Header>
  <div class="grid max-h-[60vh] gap-3 overflow-y-auto px-5 py-4">
    {#each sectionLabels.searchHelpExamples as example}
      <div class="grid gap-1 rounded-md border border-base-300 bg-base-200/40 p-3 sm:grid-cols-[12rem_1fr] sm:items-start">
        <div>
          <div class="font-mono text-sm">{example.syntax}</div>
          <div class="mt-1 font-mono text-base-content/60 text-xs">{example.example}</div>
        </div>
        <p class="text-base-content/70 text-sm">{example.description}</p>
      </div>
    {/each}
  </div>
  <Dialog.Footer>
    <Button
      onclick={() => {
        isSearchHelpOpen = false;
      }}
      type="button"
      variant="outline"
    >
      {sectionLabels.close}
    </Button>
  </Dialog.Footer>
</Dialog.Root>
