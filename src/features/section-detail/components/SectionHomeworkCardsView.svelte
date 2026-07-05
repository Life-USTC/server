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

function handleHomeworkKeydown(
  event: KeyboardEvent,
  homework: SectionHomework,
) {
  if (event.key !== "Enter" && event.key !== " ") return;

  event.preventDefault();
  selectHomework(homework);
}
</script>

<div class="grid gap-3" data-testid="section-homeworks-cards">
  {#each homeworks as homework}
    <Item.Root
      class="cursor-pointer items-start text-left hover:bg-muted"
      id={`homework-${homework.id}`}
      role="button"
      tabindex={0}
      variant="outline"
      onclick={() => {
        selectHomework(homework);
      }}
      onkeydown={(event) => handleHomeworkKeydown(event, homework)}
    >
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
    </Item.Root>
  {:else}
    <Empty.Root>
      <Empty.Header>
        <Empty.Description>{sectionCopy.noHomework}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/each}
</div>
