<script lang="ts">
import EmptyState from "#lib/components/EmptyState.svelte";
import { Button, type ButtonVariant } from "#lib/components/ui/button/index.js";

type WorkspaceNoSubscriptionsAction = {
  href?: string;
  label: string;
  onclick?: () => void;
  variant?: ButtonVariant;
};

export let title: string;
export let description: string;
export let actions: readonly WorkspaceNoSubscriptionsAction[];
let className = "";

export { className as class };
</script>

<EmptyState variant="start" class={className} {title} {description}>
  <div class="grid w-full gap-2 sm:flex sm:flex-wrap">
    {#each actions as action}
      <Button
        class="w-full sm:w-auto"
        href={action.href}
        type={action.href ? undefined : "button"}
        variant={action.variant}
        onclick={action.onclick}
      >
        {action.label}
      </Button>
    {/each}
  </div>
</EmptyState>
