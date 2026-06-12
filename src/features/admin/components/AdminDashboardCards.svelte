<script lang="ts">
import type { AdminDashboardCard } from "@/features/admin/lib/admin-dashboard-card-data";

export let cards: AdminDashboardCard[];
</script>

<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
  {#each cards as card}
    {@const Icon = card.icon}
    <a
      class={`rounded-md border border-base-300 border-l-4 bg-base-100 p-4 no-underline transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${card.tone}`}
      href={card.href}
    >
      <div class="grid min-h-36 gap-3">
        <div class="flex items-start gap-3">
          <span class={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${card.iconTone}`}>
            <Icon />
          </span>
          <div class="min-w-0">
            <span class="font-medium">{card.label}</span>
            <p class="mt-1 text-base-content/60 text-sm">
              {card.description}
            </p>
          </div>
        </div>
        <div class="mt-auto">
          <strong class="text-3xl">{card.value}</strong>
          <span class="ml-2 text-base-content/60 text-sm">{card.meta}</span>
        </div>
      </div>
    </a>
  {/each}
</div>
