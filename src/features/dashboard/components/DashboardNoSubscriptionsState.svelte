<script lang="ts">
import { Button, type ButtonVariant } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import { cn } from "$lib/utils.js";

type DashboardNoSubscriptionsAction = {
  href: string;
  label: string;
  variant?: ButtonVariant;
};

export let title: string;
export let description: string;
export let actions: readonly DashboardNoSubscriptionsAction[];
let className = "";

export { className as class };
</script>

<Empty.Root
  class={cn(
    "items-start border border-base-300 bg-base-100 text-left shadow-sm",
    className,
  )}
>
  <Empty.Header class="items-start text-left">
    <Empty.Title>{title}</Empty.Title>
    <Empty.Description>{description}</Empty.Description>
  </Empty.Header>
  <Empty.Content class="items-start">
    <div class="flex flex-wrap gap-2">
      {#each actions as action}
        <Button class="min-w-28" href={action.href} size="lg" variant={action.variant}>
          {action.label}
        </Button>
      {/each}
    </div>
  </Empty.Content>
</Empty.Root>
