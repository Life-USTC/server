<script lang="ts">
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import type { Component, Snippet } from "svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { isDemoNavigationDestination } from "@/features/demo/lib/demo-navigation";

let {
  title,
  icon: Icon,
  href,
  linkLabel,
  nested = false,
  demo = false,
  busy,
  testId,
  children,
}: {
  title: string;
  icon: Component;
  href: string;
  linkLabel: string;
  nested?: boolean;
  demo?: boolean;
  busy: boolean;
  testId: string;
  children: Snippet;
} = $props();

const disabled = $derived(demo && !isDemoNavigationDestination(href));
</script>

<svelte:element this={nested ? "div" : "section"} class={["grid min-w-0 content-start gap-2", nested && "rounded-xl border p-4"]} data-testid={testId} aria-busy={busy}>
  <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
    <svelte:element this={nested ? "h3" : "h2"} class="flex min-w-0 items-center gap-2 font-semibold text-base tracking-tight">
      <Icon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span class="min-w-0 truncate">{title}</span>
    </svelte:element>
    <Button
      class="h-auto min-h-6 gap-0.5 px-0 text-muted-foreground md:min-h-6"
      href={disabled ? undefined : href}
      {disabled}
      aria-describedby={disabled ? "demo-unavailable" : undefined}
      size="sm"
      variant="link"
    >
      {linkLabel}
      <ChevronRightIcon class="size-4" aria-hidden="true" />
    </Button>
  </div>
  {@render children()}
</svelte:element>
