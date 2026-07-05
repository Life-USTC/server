<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";

type ModerationHomework = {
  createdAt: string | Date;
  deletedAt?: string | Date | null;
  id: string;
  section: {
    code: string;
    course: { nameCn: string };
  };
  submissionDueAt?: string | Date | null;
  title: string;
};

type HomeworksCopy = {
  deleteHomeworkAction: string;
  homeworkStatusActive: string;
  homeworkStatusDeleted: string;
  homeworkTiming: string;
  noHomeworks: string;
  notAvailable: string;
};

export let copy: HomeworksCopy;
export let formatDate: (value: string | Date) => string;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let homeworks: ModerationHomework[];
export let onDelete: (homework: ModerationHomework) => void;
</script>

<section class="grid gap-3">
  {#each homeworks as homework}
    <Card.Root>
      <Card.Header>
        <Card.Title>{homework.title}</Card.Title>
        <Card.Description>
          {homework.section.course.nameCn} · {homework.section.code}
        </Card.Description>
        <Card.Action>
          {#if homework.deletedAt}
            <Badge variant="destructive">{copy.homeworkStatusDeleted}</Badge>
          {:else}
            <Badge>{copy.homeworkStatusActive}</Badge>
          {/if}
        </Card.Action>
      </Card.Header>
      <Card.Content>
        <p class="text-muted-foreground text-sm">
          {formatMessage(copy.homeworkTiming, {
            created: formatDate(homework.createdAt),
            due: homework.submissionDueAt
              ? formatDate(homework.submissionDueAt)
              : copy.notAvailable,
          })}
        </p>
      </Card.Content>
      {#if !homework.deletedAt}
        <Card.Footer>
          <Button
            size="sm"
            type="button"
            variant="destructive"
            onclick={() => onDelete(homework)}
          >
            {copy.deleteHomeworkAction}
          </Button>
        </Card.Footer>
      {/if}
    </Card.Root>
  {:else}
    <Empty.Root class="min-h-24">
      <Empty.Header>
        <Empty.Description>{copy.noHomeworks}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/each}
</section>
