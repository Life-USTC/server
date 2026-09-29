<script lang="ts">
import CollectionPage from "$lib/components/CollectionPage.svelte";
import LegalDocument from "../_components/LegalDocument.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<CollectionPage panel={false} width="reading">
  <LegalDocument content={data.content} />
</CollectionPage>
