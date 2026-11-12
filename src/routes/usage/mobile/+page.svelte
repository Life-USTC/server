<script lang="ts">
import DemoInformationPage from "@/features/demo/components/DemoInformationPage.svelte";
import MobileAppPage from "@/features/mobile-app/components/MobileAppPage.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<DemoInformationPage pageDemo={data.pageDemo} pageLocale={data.pageLocale} locale={data.locale} demo={data.demo}>
<MobileAppPage {data} readOnlyReason={data.demo?.readOnlyReason ?? ""} />

</DemoInformationPage>
