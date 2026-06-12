<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Tabs from "$lib/components/ui/tabs/index.js";
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
</script>

<div class="flex flex-wrap items-center justify-end gap-2">
  <div class="flex flex-wrap items-center gap-2">
    {#if canWriteHomework}
      <Button size="sm" type="button" onclick={openCreateHomeworkDialog}>
        {homeworkCopy.showCreate}
      </Button>
    {:else if !isAuthenticated}
      <Button
        href={`/signin?callbackUrl=${encodeURIComponent(`/sections/${sectionJwId}`)}`}
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
    <Tabs.List aria-label={sectionCopy.homeworkView}>
      <Tabs.Button
        onclick={() => setHomeworkView("cards")}
        selected={homeworkView === "cards"}
      >
        {sectionCopy.cardsView}
      </Tabs.Button>
      <Tabs.Button
        onclick={() => setHomeworkView("list")}
        selected={homeworkView === "list"}
      >
        {sectionCopy.listView}
      </Tabs.Button>
    </Tabs.List>
  </div>
</div>
