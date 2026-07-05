<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type {
  SectionCopy,
  SectionHomework,
  SectionHomeworkCopy,
} from "./section-homework-tab-types";

export let fmtDateTime: (value: string | Date | null | undefined) => string;
export let homeworkCopy: SectionHomeworkCopy;
export let homeworkStatus: (homework: SectionHomework) => string;
export let homeworks: SectionHomework[];
export let sectionCopy: SectionCopy;
export let selectHomework: (homework: SectionHomework) => void;
</script>

<Item.Group data-testid="section-homeworks-cards">
  {#each homeworks as homework}
    <Item.Root
      class="items-start text-left"
      id={`homework-${homework.id}`}
      variant="outline"
    >
      {#snippet child({ props })}
        <button {...props} type="button" onclick={() => selectHomework(homework)}>
          <Item.Content>
            <Item.Title>{homework.title}</Item.Title>
            <Item.Description>
              {sectionCopy.due} {fmtDateTime(homework.submissionDueAt)}
            </Item.Description>
            {#if homework.description?.content}
              <Item.Description class="line-clamp-3 whitespace-pre-wrap">
                {homework.description.content}
              </Item.Description>
            {/if}
          </Item.Content>
          <Item.Actions class="flex-wrap justify-end">
            {#if homework.isMajor}
              <Badge variant="secondary">{homeworkCopy.tagMajor}</Badge>
            {/if}
            {#if homework.requiresTeam}
              <Badge variant="secondary">{homeworkCopy.tagTeam}</Badge>
            {/if}
            <Badge>{homeworkStatus(homework)}</Badge>
          </Item.Actions>
        </button>
      {/snippet}
    </Item.Root>
  {:else}
    <Empty.Root>
      <Empty.Header>
        <Empty.Description>{sectionCopy.noHomework}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/each}
</Item.Group>
