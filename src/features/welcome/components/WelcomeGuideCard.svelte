<script lang="ts">
import ArrowLeft from "@lucide/svelte/icons/arrow-left";
import CalendarCheck from "@lucide/svelte/icons/calendar-check";
import ShieldCheck from "@lucide/svelte/icons/shield-check";
import Sparkles from "@lucide/svelte/icons/sparkles";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import type { WelcomeCopy } from "./welcome-component-types";

export let backUrl: string | null;
export let finishUrl: string;
export let welcomeCopy: WelcomeCopy;

$: guides = [
  {
    icon: Sparkles,
    title: welcomeCopy.guideWorkspaceTitle,
    description: welcomeCopy.guideWorkspaceDescription,
  },
  {
    icon: CalendarCheck,
    title: welcomeCopy.guidePlanningTitle,
    description: welcomeCopy.guidePlanningDescription,
  },
  {
    icon: ShieldCheck,
    title: welcomeCopy.guideAccountTitle,
    description: welcomeCopy.guideAccountDescription,
  },
];
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{welcomeCopy.finishTitle}</Card.Title>
    <Card.Description>{welcomeCopy.finishDescription}</Card.Description>
  </Card.Header>
  <Card.Content class="grid gap-4">
    {#each guides as guide (guide.title)}
      <div class="flex items-start gap-3">
        <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
          <guide.icon class="size-4" />
        </span>
        <div class="grid gap-0.5">
          <p class="font-medium text-sm">{guide.title}</p>
          <p class="text-muted-foreground text-xs leading-5">{guide.description}</p>
        </div>
      </div>
    {/each}
  </Card.Content>
  <Card.Footer class="flex flex-wrap justify-between gap-2">
    {#if backUrl}
      <Button href={backUrl} variant="ghost">
        <ArrowLeft data-icon="inline-start" />
        {welcomeCopy.back}
      </Button>
    {/if}
    <Button class="ms-auto" href={finishUrl}>{welcomeCopy.startUsing}</Button>
  </Card.Footer>
</Card.Root>
