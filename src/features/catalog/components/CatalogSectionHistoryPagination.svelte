<script lang="ts">
import type { PaginatedResponse } from "@/lib/pagination";
import { page as currentPage } from "$app/stores";
import ListPagination from "$lib/components/ListPagination.svelte";
import ResultsSummary from "$lib/components/ResultsSummary.svelte";

let {
  pagination,
  shown,
  summaryTemplate,
  ariaLabel,
  nextLabel,
  previousLabel,
}: {
  pagination: PaginatedResponse<unknown>["pagination"];
  shown: number;
  summaryTemplate: string;
  ariaLabel: string;
  nextLabel: string;
  previousLabel: string;
} = $props();

const { page, pageSize, total, totalPages } = $derived(pagination);
const summary = $derived(
  summaryTemplate
    .replace("{from}", String(shown ? (page - 1) * pageSize + 1 : 0))
    .replace("{to}", String(shown ? (page - 1) * pageSize + shown : 0))
    .replace("{total}", String(total)),
);

function pageHref(targetPage: number) {
  const params = new URLSearchParams($currentPage.url.searchParams);
  if (targetPage === 1) params.delete("sectionsPage");
  else params.set("sectionsPage", String(targetPage));
  return `${$currentPage.url.pathname}${params.size ? `?${params}` : ""}#sections`;
}
</script>

<div class="mb-4 grid gap-3" data-testid="section-history-pagination">
  <ResultsSummary {summary} {page} {totalPages} />
  <ListPagination
    {page}
    {totalPages}
    {pageHref}
    {ariaLabel}
    {nextLabel}
    nextPageLabel={nextLabel}
    {previousLabel}
    previousPageLabel={previousLabel}
  />
</div>
