<script lang="ts">
import PageHeader from "$lib/components/PageHeader.svelte";
import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import type {
  AdminOAuthAdminCopy,
  AdminOAuthCommonCopy,
  AdminOAuthCopy,
} from "./admin-oauth-client-types";

export let adminCopy: AdminOAuthAdminCopy;
export let commonCopy: AdminOAuthCommonCopy;
export let copy: AdminOAuthCopy & {
  adminSubtitle: string;
  adminTitle: string;
  createClient: string;
};
export let disabled = false;
export let onCreate: () => void;
</script>

<PageHeader title={copy.adminTitle} description={copy.adminSubtitle} eyebrow={adminCopy.title}>
  {#snippet breadcrumb()}
    <Breadcrumb.Root>
      <Breadcrumb.List>
        <Breadcrumb.Item><Breadcrumb.Link href="/">{commonCopy.home}</Breadcrumb.Link></Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item><Breadcrumb.Link href="/admin">{adminCopy.title}</Breadcrumb.Link></Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item><Breadcrumb.Page>{copy.adminTitle}</Breadcrumb.Page></Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb.Root>
  {/snippet}
  {#snippet actions()}
    <Button class="w-full sm:w-auto" size="sm" type="button" {disabled} onclick={onCreate}>
      {copy.createClient}
    </Button>
  {/snippet}
</PageHeader>
