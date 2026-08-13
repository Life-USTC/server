<script lang="ts">
import UsageGuidePage from "@/features/usage/components/UsageGuidePage.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<UsageGuidePage
  {data}
  kind="bot"
  primaryHref="https://qm.qq.com/q/eOL0WhizeM"
  primaryQrSrc="/images/usage/presto-qq-qr.png"
/>
