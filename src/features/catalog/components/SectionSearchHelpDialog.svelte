<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import * as Item from "$lib/components/ui/item/index.js";

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
  bind:open={isSearchHelpOpen}
>
  <Dialog.Content
    aria-label="Section search help"
    class="max-w-2xl"
  >
    <Dialog.Header>
      <Dialog.Title>{sectionLabels.searchHelpTitle}</Dialog.Title>
      <Dialog.Description>{sectionLabels.searchHelpDescription}</Dialog.Description>
    </Dialog.Header>
    <Item.Group class="max-h-[60vh] overflow-y-auto px-5 py-4">
      {#each sectionLabels.searchHelpExamples as example}
        <Item.Root
          class="items-start sm:flex-nowrap"
          variant="muted"
        >
          <Item.Content class="min-w-0 sm:max-w-48 sm:flex-none">
            <Item.Title class="font-mono">{example.syntax}</Item.Title>
            <Item.Description class="font-mono text-xs">
              {example.example}
            </Item.Description>
          </Item.Content>
          <Item.Content class="min-w-0">
            <Item.Description class="line-clamp-none">
              {example.description}
            </Item.Description>
          </Item.Content>
        </Item.Root>
      {/each}
    </Item.Group>
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
  </Dialog.Content>
</Dialog.Root>
