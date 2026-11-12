<script lang="ts">
import CollectionPage from "#lib/components/CollectionPage.svelte";
import DemoInformationPage from "@/features/demo/components/DemoInformationPage.svelte";
import LegalDocument from "../_components/LegalDocument.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<DemoInformationPage pageDemo={data.pageDemo} pageLocale={data.pageLocale} locale={data.locale} demo={data.demo}>
<CollectionPage panel={false} width="reading">
  <LegalDocument content={data.content} />
</CollectionPage>

</DemoInformationPage>
