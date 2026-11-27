<script lang="ts">
import DemoInformationPage from "@/features/demo/components/DemoInformationPage.svelte";
import type { PageData } from "./$types";
import MobileAppPage from "./MobileAppPage.svelte";

export let data: PageData;
</script>

<DemoInformationPage pageDemo={data.pageDemo} pageLocale={data.pageLocale} locale={data.locale} demo={data.demo}>
  <MobileAppPage {data} />
</DemoInformationPage>
