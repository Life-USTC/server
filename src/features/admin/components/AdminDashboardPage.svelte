<script lang="ts">
import {
  type AdminDashboardCardData,
  type AdminDashboardCommonCopy,
  adminDashboardCards,
  adminDashboardQueueCards,
} from "@/features/admin/lib/admin-dashboard-card-data";
import AdminDashboardCards from "./AdminDashboardCards.svelte";
import AdminDashboardHeader from "./AdminDashboardHeader.svelte";
import AdminDashboardQueues from "./AdminDashboardQueues.svelte";

export let data: AdminDashboardCardData & {
  copy: AdminDashboardCardData["copy"] & {
    common: AdminDashboardCommonCopy;
    title: string;
  };
};

$: cards = adminDashboardCards(data);
$: queueCards = adminDashboardQueueCards(data);
</script>

<svelte:head><title>{data.copy.title} - Life@USTC</title></svelte:head>

<section class="grid gap-5">
  <AdminDashboardHeader
    commonCopy={data.copy.common}
    copy={data.copy}
    openItems={data.summary.activeComments + data.summary.suspensions}
  />

  <AdminDashboardCards {cards} />

  <AdminDashboardQueues copy={data.copy} {queueCards} />
</section>
