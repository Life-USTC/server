<script lang="ts">
import type { ButtonVariant } from "$lib/components/ui/button/button-variants";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";

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

<Card.Root class={className}>
  <Card.Content class="grid justify-items-start gap-4 pt-5">
    <div>
      <Card.Title>{title}</Card.Title>
      <p class="text-base-content/60 text-sm">
        {description}
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      {#each actions as action}
        <Button class="min-w-28" href={action.href} size="lg" variant={action.variant}>
          {action.label}
        </Button>
      {/each}
    </div>
  </Card.Content>
</Card.Root>
