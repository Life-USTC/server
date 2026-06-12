<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";

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
      <Card.Content class="grid gap-3 pt-5">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <Card.Title>{homework.title}</Card.Title>
            <p class="text-base-content/60 text-sm">
              {homework.section.course.nameCn} · {homework.section.code}
            </p>
          </div>
          {#if homework.deletedAt}
            <Badge class="border-error/40 bg-error/10 text-error">{copy.homeworkStatusDeleted}</Badge>
          {:else}
            <Badge class="border-success/40 bg-success/10 text-success">{copy.homeworkStatusActive}</Badge>
          {/if}
        </div>
        <p class="text-base-content/60 text-sm">
          {formatMessage(copy.homeworkTiming, {
            created: formatDate(homework.createdAt),
            due: homework.submissionDueAt
              ? formatDate(homework.submissionDueAt)
              : copy.notAvailable,
          })}
        </p>
        {#if !homework.deletedAt}
          <Button
            class="border-error bg-error text-error-content hover:bg-error/90"
            size="sm"
            type="button"
            onclick={() => onDelete(homework)}
          >
            {copy.deleteHomeworkAction}
          </Button>
        {/if}
      </Card.Content>
    </Card.Root>
  {:else}
    <Alert>{copy.noHomeworks}</Alert>
  {/each}
</section>
