<script lang="ts">
import YoungCalendarPage from "@/features/young/components/YoungCalendarPage.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.copy.youngEvents.calendarTitle} - Life@USTC</title>
</svelte:head>

<YoungCalendarPage
  anchorDate={data.anchorDate}
  copy={data.copy}
  data={data.data}
  filters={data.filters}
  locale={data.locale}
  range={data.range}
  source={data.source}
  unknownDateCount={data.unknownDateCount}
  view={data.view}
/>
