<script lang="ts">
import SectionHomeworkCardsView from "./SectionHomeworkCardsView.svelte";
import SectionHomeworkListView from "./SectionHomeworkListView.svelte";
import SectionHomeworkToolbar from "./SectionHomeworkToolbar.svelte";
import type {
  HomeworkView,
  SectionCopy,
  SectionHomework,
  SectionHomeworkCopy,
} from "./section-homework-tab-types";

export let canWriteHomework: boolean;
export let fmtDateTime: (value: string | Date | null | undefined) => string;
export let homeworkCopy: SectionHomeworkCopy;
export let homeworkStatus: (homework: SectionHomework) => string;
export let homeworkView: HomeworkView;
export let homeworks: SectionHomework[];
export let isAuthenticated: boolean;
export let openAuditDialog: () => void;
export let openCreateHomeworkDialog: () => void;
export let sectionCopy: SectionCopy;
export let sectionJwId: number | string;
export let selectHomework: (homework: SectionHomework) => void;
export let setHomeworkView: (view: HomeworkView) => void;
</script>

<section class="grid gap-4">
  <SectionHomeworkToolbar
    {canWriteHomework}
    {homeworkCopy}
    {homeworkView}
    {isAuthenticated}
    {openAuditDialog}
    {openCreateHomeworkDialog}
    {sectionCopy}
    {sectionJwId}
    {setHomeworkView}
  />

  {#if homeworkView === "list"}
    <SectionHomeworkListView
      {fmtDateTime}
      {homeworkCopy}
      {homeworks}
      {sectionCopy}
      {selectHomework}
    />
  {:else}
    <SectionHomeworkCardsView
      {fmtDateTime}
      {homeworkCopy}
      {homeworkStatus}
      {homeworks}
      {sectionCopy}
      {selectHomework}
    />
  {/if}
</section>
