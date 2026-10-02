<script lang="ts">
import PageHeader from "$lib/components/PageHeader.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import type {
  AdminModerationAdminCopy,
  AdminModerationCopy,
} from "./admin-moderation-page-types";

export let adminCopy: AdminModerationAdminCopy;
export let copy: AdminModerationCopy;
export let isRefreshing: boolean;
export let refreshQueue: () => void | Promise<void>;
</script>

<PageHeader title={copy.title} description={copy.pageDescription} eyebrow={adminCopy.title}>
  {#snippet actions()}
    <Button
      class="w-full sm:w-auto"
      disabled={isRefreshing}
      type="button"
      variant="outline"
      onclick={refreshQueue}
    >
      {isRefreshing ? copy.refreshingQueue : copy.refreshQueue}
    </Button>
  {/snippet}
</PageHeader>
