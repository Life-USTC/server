<script lang="ts">
import SectionHomeworkListView from "./SectionHomeworkListView.svelte";
import type {
  SectionCopy,
  SectionHomework,
  SectionHomeworkCopy,
} from "./section-homework-tab-types";

export let fmtDateTime: (value: string | Date | null | undefined) => string;
export let homeworkCopy: SectionHomeworkCopy;
export let homeworks: SectionHomework[];
export let sectionCopy: SectionCopy;
export let selectHomework: (homework: SectionHomework) => void | Promise<void>;
</script>

<section class="grid gap-4">
  <SectionHomeworkListView
    {fmtDateTime}
    {homeworkCopy}
    {homeworks}
    {sectionCopy}
    {selectHomework}
  />
</section>
