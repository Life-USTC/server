<script lang="ts">
import ArrowLeft from "@lucide/svelte/icons/arrow-left";
import CalendarCheck from "@lucide/svelte/icons/calendar-check";
import ShieldCheck from "@lucide/svelte/icons/shield-check";
import Sparkles from "@lucide/svelte/icons/sparkles";
import WelcomeGuideRow from "@/features/welcome/components/WelcomeGuideRow.svelte";
import { Button } from "$lib/components/ui/button/index.js";
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

<section class="grid gap-6">
  <header class="grid gap-1.5">
    <h2 class="font-semibold leading-none tracking-tight">{welcomeCopy.finishTitle}</h2>
    <p class="text-muted-foreground text-sm">{welcomeCopy.finishDescription}</p>
  </header>

  <div class="grid gap-4">
    {#each guides as guide (guide.title)}
      <WelcomeGuideRow
        description={guide.description}
        icon={guide.icon}
        title={guide.title}
      />
    {/each}
  </div>

  <footer class="flex flex-wrap justify-between gap-2">
    {#if backUrl}
      <Button href={backUrl} variant="ghost">
        <ArrowLeft data-icon="inline-start" />
        {welcomeCopy.back}
      </Button>
    {/if}
    <Button class="ms-auto" href={finishUrl}>{welcomeCopy.startUsing}</Button>
  </footer>
</section>
