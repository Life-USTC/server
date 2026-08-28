<script lang="ts">
import ArrowLeft from "@lucide/svelte/icons/arrow-left";
import CalendarCheck from "@lucide/svelte/icons/calendar-check";
import Share2 from "@lucide/svelte/icons/share-2";
import UserRound from "@lucide/svelte/icons/user-round";
import WelcomeGuideRow from "@/features/welcome/components/WelcomeGuideRow.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import type { WelcomeCopy } from "./welcome-component-types";

export let backUrl: string | null;
export let finishUrl: string;
export let welcomeCopy: WelcomeCopy;

$: guides = [
  {
    icon: CalendarCheck,
    title: welcomeCopy.guideWorkspaceTitle,
    description: welcomeCopy.guideWorkspaceDescription,
  },
  {
    icon: UserRound,
    title: welcomeCopy.guideProfileTitle,
    description: welcomeCopy.guideProfileDescription,
  },
  {
    icon: Share2,
    title: welcomeCopy.guideAppsTitle,
    description: welcomeCopy.guideAppsDescription,
  },
];
</script>

<section class="grid gap-6">
  <header class="grid gap-1.5">
    <h2 class="font-semibold leading-none tracking-tight">{welcomeCopy.finishTitle}</h2>
    <p class="text-muted-foreground text-sm leading-6">{welcomeCopy.finishDescription}</p>
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
