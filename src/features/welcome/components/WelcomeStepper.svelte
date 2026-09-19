<script lang="ts">
import Check from "@lucide/svelte/icons/check";
import type { WelcomeStepIndicator } from "./welcome-component-types";

export let progressLabel: string;
export let steps: WelcomeStepIndicator[];
</script>

<nav aria-label={progressLabel} class="grid gap-3">
  <p class="text-muted-foreground text-xs">{progressLabel}</p>
  <ol class="flex flex-wrap items-center gap-x-3 gap-y-2">
    {#each steps as step (step.id)}
      <li
        aria-current={step.state === "current" ? "step" : undefined}
        class="flex items-center gap-2 text-sm"
        data-step-state={step.state}
      >
        <span
          class="flex size-6 shrink-0 items-center justify-center rounded-full border text-xs {step.state === 'current'
            ? 'border-primary bg-primary text-primary-foreground'
            : step.state === 'complete'
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border text-muted-foreground'}"
        >
          {#if step.state === "complete"}
            <Check class="size-3.5" />
          {:else}
            {step.number}
          {/if}
        </span>
        <span class={step.state === "current" ? "font-medium" : "text-muted-foreground"}>
          {step.label}
        </span>
      </li>
    {/each}
  </ol>
</nav>
