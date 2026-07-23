<script lang="ts">
import { Button, type ButtonVariant } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import { cn } from "$lib/utils.js";

type DashboardNoSubscriptionsAction = {
  href?: string;
  label: string;
  onclick?: () => void;
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
    "items-start text-left",
    className,
  )}
>
  <Empty.Header class="items-start text-left">
    <Empty.Title>{title}</Empty.Title>
    <Empty.Description>{description}</Empty.Description>
  </Empty.Header>
  <Empty.Content class="w-full items-start">
    <div class="grid w-full gap-2 sm:flex sm:flex-wrap">
      {#each actions as action}
        <Button
          class="w-full sm:w-auto"
          href={action.href}
          size="lg"
          type={action.href ? undefined : "button"}
          variant={action.variant}
          onclick={action.onclick}
        >
          {action.label}
        </Button>
      {/each}
    </div>
  </Empty.Content>
</Empty.Root>
