<script lang="ts">
import * as Card from "$lib/components/ui/card/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type { SettingsCopy } from "./settings-component-types";

export let copy: SettingsCopy;
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{copy.settings.content.title}</Card.Title>
    <Card.Description>
      {copy.settings.content.description}
    </Card.Description>
  </Card.Header>
  <Card.Content class="grid gap-5">
    <Empty.Root>
      <Empty.Header>
        <Empty.Title>{copy.settings.content.emptyTitle}</Empty.Title>
        <Empty.Description>{copy.settings.content.emptyDescription}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
    <Item.Group class="grid gap-3 sm:grid-cols-2">
      <Item.Root variant="outline">
        {#snippet child({ props })}
          <a {...props} href="/sections">
            <Item.Content>
              <Item.Title>{copy.settings.content.browseSections.title}</Item.Title>
              <Item.Description>
                {copy.settings.content.browseSections.description}
              </Item.Description>
            </Item.Content>
          </a>
        {/snippet}
      </Item.Root>
      <Item.Root variant="outline">
        {#snippet child({ props })}
          <a {...props} href="/guides/markdown-support">
            <Item.Content>
              <Item.Title>{copy.settings.content.commentGuide.title}</Item.Title>
              <Item.Description>
                {copy.settings.content.commentGuide.description}
              </Item.Description>
            </Item.Content>
          </a>
        {/snippet}
      </Item.Root>
    </Item.Group>
  </Card.Content>
</Card.Root>
