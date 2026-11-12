<script lang="ts">
import DemoInformationPage from "@/features/demo/components/DemoInformationPage.svelte";
import UsageGuidePage from "@/features/usage/components/UsageGuidePage.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<DemoInformationPage pageDemo={data.pageDemo} pageLocale={data.pageLocale} locale={data.locale} demo={data.demo}>
<UsageGuidePage
  {data}
  readOnlyReason={data.demo?.readOnlyReason ?? ""}
  kind="bot"
  primaryHref="https://qm.qq.com/q/eOL0WhizeM"
  primaryQrSrc="/images/usage/presto-qq-qr.png"
/>

</DemoInformationPage>
