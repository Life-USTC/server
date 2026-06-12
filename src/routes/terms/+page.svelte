<script lang="ts">
import LegalDocument from "../_components/LegalDocument.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<LegalDocument content={data.content} />
