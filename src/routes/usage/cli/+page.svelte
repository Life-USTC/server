<script lang="ts">
import UsageGuidePage from "@/features/usage/components/UsageGuidePage.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<UsageGuidePage
  {data}
  kind="cli"
  primaryHref="https://github.com/Life-USTC/CLI"
/>
