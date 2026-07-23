<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
import type {
  HomeworkView,
  SectionCopy,
  SectionHomeworkCopy,
} from "./section-homework-tab-types";

export let canWriteHomework: boolean;
export let homeworkCopy: SectionHomeworkCopy;
export let homeworkView: HomeworkView;
export let isAuthenticated: boolean;
export let openAuditDialog: () => void;
export let openCreateHomeworkDialog: () => void;
export let sectionCopy: SectionCopy;
export let sectionJwId: number | string;
export let setHomeworkView: (view: HomeworkView) => void;

function handleHomeworkViewChange(value: string) {
  if (value === "cards" || value === "list") {
    setHomeworkView(value);
  }
}
</script>

<div class="flex flex-wrap items-center justify-end gap-2">
  <div class="flex flex-wrap items-center gap-2">
    {#if canWriteHomework}
      <Button size="sm" type="button" onclick={openCreateHomeworkDialog}>
        {homeworkCopy.showCreate}
      </Button>
    {:else if !isAuthenticated}
      <Button
        href={`/account/sign-in?callbackUrl=${encodeURIComponent(`/catalog/sections/${sectionJwId}`)}`}
        size="sm"
        variant="outline"
      >
        {homeworkCopy.loginToCreate}
      </Button>
    {/if}
    <Button
      size="sm"
      type="button"
      variant="outline"
      onclick={openAuditDialog}
    >
      {homeworkCopy.auditTitle}
    </Button>
    <ToggleGroup.Root
      aria-label={sectionCopy.homeworkView}
      type="single"
      value={homeworkView}
      variant="outline"
      onValueChange={handleHomeworkViewChange}
    >
      <ToggleGroup.Item value="cards">{sectionCopy.cardsView}</ToggleGroup.Item>
      <ToggleGroup.Item value="list">{sectionCopy.listView}</ToggleGroup.Item>
    </ToggleGroup.Root>
  </div>
</div>
