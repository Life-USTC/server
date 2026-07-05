<script lang="ts">
import Download from "@lucide/svelte/icons/download";
import PageHeader from "$lib/components/PageHeader.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import type { AdminBusCopy, AdminBusHeaderAdminCopy } from "./admin-bus-types";

export let adminCopy: AdminBusHeaderAdminCopy;
export let copy: AdminBusCopy;
export let disabled = false;
export let onImport: () => void;
</script>

<PageHeader title={copy.title} description={copy.subtitle} eyebrow={adminCopy.title}>
  {#snippet actions()}
    <Button class="w-full sm:w-auto" size="sm" type="button" {disabled} onclick={onImport}>
      <Download data-icon="inline-start" />
      {copy.importAction}
    </Button>
  {/snippet}
</PageHeader>
