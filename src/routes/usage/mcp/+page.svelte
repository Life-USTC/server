<script lang="ts">
import DemoInformationPage from "@/features/demo/components/DemoInformationPage.svelte";
import type { PageData } from "./$types";
import McpUsagePage from "./McpUsagePage.svelte";

export let data: PageData;
</script>

<DemoInformationPage pageDemo={data.pageDemo} pageLocale={data.pageLocale} locale={data.locale} demo={data.demo}>
  <McpUsagePage {data} />
</DemoInformationPage>
