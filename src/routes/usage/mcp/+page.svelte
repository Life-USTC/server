<script lang="ts">
import DemoInformationPage from "@/features/demo/components/DemoInformationPage.svelte";
import McpUsagePage from "@/features/usage/components/McpUsagePage.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<DemoInformationPage pageDemo={data.pageDemo} pageLocale={data.pageLocale} locale={data.locale} demo={data.demo}>
<McpUsagePage {data} readOnlyReason={data.demo?.readOnlyReason ?? ""} />

</DemoInformationPage>
