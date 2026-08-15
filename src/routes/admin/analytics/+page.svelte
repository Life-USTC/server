<script lang="ts">
import AdminWorkspace from "@/features/admin/components/AdminWorkspace.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import type { PageData } from "./$types";

export let data: PageData;

function daysLabel(days: number) {
  return data.copy.analytics.days.replace("{days}", String(days));
}
</script>

<svelte:head><title>{data.copy.analytics.title} - Life@USTC</title></svelte:head>

<AdminWorkspace>
  {#snippet header()}
    <PageHeader title={data.copy.analytics.title} description={data.copy.analytics.subtitle} eyebrow={data.copy.admin.title} />
  {/snippet}
  {#snippet controls()}
    <Card.Root>
      <Card.Header><Card.Title>{data.copy.analytics.window}</Card.Title></Card.Header>
      <Card.Content class="flex flex-wrap gap-2">
        {#each [7, 30, 90] as days}
          <Button href={`/admin/analytics?days=${days}`} variant={data.days === days ? "default" : "outline"}>{daysLabel(days)}</Button>
        {/each}
      </Card.Content>
    </Card.Root>
  {/snippet}
  {#snippet summary()}
    <Card.Root><Card.Header><Card.Description>{data.copy.analytics.total}</Card.Description><Card.Title class="text-3xl">{data.total}</Card.Title></Card.Header></Card.Root>
  {/snippet}

  <Card.Root>
    <Card.Content class="p-0">
      {#if data.rows.length === 0}
        <p class="p-6 text-sm text-muted-foreground">{data.copy.analytics.noData}</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full min-w-[720px] text-left text-sm">
            <thead class="border-b bg-muted/40"><tr><th class="p-3">{data.copy.analytics.feature}</th><th class="p-3">{data.copy.analytics.channel}</th><th class="p-3">{data.copy.analytics.outcome}</th><th class="p-3">{data.copy.analytics.client}</th><th class="p-3 text-right">{data.copy.analytics.count}</th></tr></thead>
            <tbody>{#each data.rows as row}<tr class="border-b last:border-0"><td class="p-3 font-medium">{row.feature}</td><td class="p-3">{row.channel}</td><td class="p-3">{row.outcome}</td><td class="p-3">{row.client}</td><td class="p-3 text-right tabular-nums">{row.count}</td></tr>{/each}</tbody>
          </table>
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</AdminWorkspace>
