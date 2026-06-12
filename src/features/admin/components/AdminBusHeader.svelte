<script lang="ts">
import Download from "$lib/components/icons/download.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import type {
  AdminBusCopy,
  AdminBusHeaderAdminCopy,
  AdminBusHeaderCommonCopy,
} from "./admin-bus-types";

export let adminCopy: AdminBusHeaderAdminCopy;
export let commonCopy: AdminBusHeaderCommonCopy;
export let copy: AdminBusCopy;
export let disabled = false;
export let onImport: () => void;
</script>

<PageHeader title={copy.title} description={copy.subtitle} eyebrow={adminCopy.title}>
  {#snippet breadcrumb()}
    <Breadcrumb.Root>
      <Breadcrumb.List>
        <Breadcrumb.Item><Breadcrumb.Link href="/">{commonCopy.home}</Breadcrumb.Link></Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item><Breadcrumb.Link href="/admin">{adminCopy.title}</Breadcrumb.Link></Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item><Breadcrumb.Page>{copy.title}</Breadcrumb.Page></Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb.Root>
  {/snippet}
  {#snippet actions()}
    <Button class="w-full sm:w-auto" size="sm" type="button" {disabled} onclick={onImport}>
      <Download />
      {copy.importAction}
    </Button>
  {/snippet}
</PageHeader>
