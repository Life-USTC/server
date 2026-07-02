<script lang="ts">
import PageHeader from "$lib/components/PageHeader.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import type {
  AdminOAuthAdminCopy,
  AdminOAuthCopy,
} from "./admin-oauth-client-types";

export let adminCopy: AdminOAuthAdminCopy;
export let copy: AdminOAuthCopy & {
  adminSubtitle: string;
  adminTitle: string;
  createClient: string;
};
export let disabled = false;
export let onCreate: () => void;
</script>

<PageHeader title={copy.adminTitle} description={copy.adminSubtitle} eyebrow={adminCopy.title}>
  {#snippet actions()}
    <Button class="w-full sm:w-auto" size="sm" type="button" {disabled} onclick={onCreate}>
      {copy.createClient}
    </Button>
  {/snippet}
</PageHeader>
