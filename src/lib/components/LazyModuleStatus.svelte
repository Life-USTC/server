<script lang="ts">
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import { Skeleton } from "#lib/components/ui/skeleton/index.js";

let {
  failed,
  heading,
  loadFailed,
  retry,
  onRetry,
}: {
  failed: boolean;
  heading: string;
  loadFailed: string;
  retry: string;
  onRetry: () => void;
} = $props();
</script>

<div class="min-h-24">
  {#if failed}
    <Alert.Root variant="destructive">
      <Alert.Description>{loadFailed}</Alert.Description>
      <Alert.Action><Button size="sm" variant="ghost" onclick={onRetry}>{retry}</Button></Alert.Action>
    </Alert.Root>
  {:else}
    <div class="grid gap-3" aria-busy="true" aria-label={heading}>
      <Skeleton class="h-4 w-full" />
      <Skeleton class="h-4 w-11/12" />
      <Skeleton class="h-4 w-4/5" />
    </div>
  {/if}
</div>
