<script lang="ts">
import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
import HelpIcon from "@lucide/svelte/icons/circle-question-mark";
import type { Snippet } from "svelte";
import { buttonVariants } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Collapsible from "$lib/components/ui/collapsible/index.js";
import * as Popover from "$lib/components/ui/popover/index.js";
import { cn } from "$lib/utils.js";

let {
  title,
  description,
  id,
  class: className,
  actions,
  collapsible = false,
  children,
}: {
  title: string;
  description?: string;
  id?: string;
  class?: string;
  actions?: Snippet;
  collapsible?: boolean;
  children: Snippet;
} = $props();
let expanded = $state(false);
</script>

<section class={cn("min-w-0", className)} aria-labelledby={id ? `${id}-title` : undefined} aria-label={id ? undefined : title} data-dashboard-panel>
  <Collapsible.Root class="h-full" open={!collapsible || expanded} onOpenChange={(value) => expanded = value}>
  <Card.Root size="sm" class="h-full min-w-0">
    <Card.Header class="min-w-0 items-center">
      <Card.Title><h2 id={id ? `${id}-title` : undefined}>{title}</h2></Card.Title>
      {#if actions || description || collapsible}
        <Card.Action class="flex items-center gap-1">
          {#if actions}{@render actions()}{/if}
          {#if collapsible}
            <Collapsible.Trigger class={buttonVariants({variant: "ghost", size: "icon-xs"})} aria-label={title}>
              <ChevronDownIcon class={cn("transition-transform", expanded && "rotate-180")} aria-hidden="true" />
            </Collapsible.Trigger>
          {/if}
          {#if description}
            <Popover.Root>
              <Popover.Trigger class={buttonVariants({variant: "ghost", size: "icon-xs"})} aria-label={description}>
                <HelpIcon aria-hidden="true" />
              </Popover.Trigger>
              <Popover.Content align="end" class="max-w-[calc(100vw-2rem)]">
                <p class="text-sm text-muted-foreground">{description}</p>
              </Popover.Content>
            </Popover.Root>
          {/if}
        </Card.Action>
      {/if}
    </Card.Header>
    <Collapsible.Content>
    <Card.Content class="grid min-w-0 gap-3 [&>*]:min-w-0">
      {@render children()}
    </Card.Content>
    </Collapsible.Content>
  </Card.Root>
  </Collapsible.Root>
</section>
