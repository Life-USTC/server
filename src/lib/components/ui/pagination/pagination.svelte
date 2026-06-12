<script lang="ts">
export let currentPage = 1;
export let getPageHref: (page: number) => string;
export let label = "Pagination";
export let nextAriaLabel = "Next page";
export let nextLabel = "Next";
export let previousAriaLabel = "Previous page";
export let previousLabel = "Previous";
export let totalPages = 1;
let className = "";

export { className as class };

function pageItems(current: number, total: number) {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const safePages = [...pages]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
  const items: Array<number | "ellipsis"> = [];
  for (const page of safePages) {
    const previous = items[items.length - 1];
    if (typeof previous === "number" && page - previous > 1) {
      items.push("ellipsis");
    }
    items.push(page);
  }
  return items;
}

$: items = pageItems(currentPage, totalPages);
</script>

{#if totalPages > 1}
  <nav class={`flex flex-wrap items-center gap-1 ${className}`} aria-label={label} data-slot="pagination">
    <a
      aria-disabled={currentPage <= 1}
      aria-label={previousAriaLabel}
      class={`inline-flex h-9 items-center justify-center rounded-lg border border-base-300 bg-base-100 px-3 text-sm shadow-sm transition-colors hover:bg-base-200 ${currentPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
      href={getPageHref(Math.max(1, currentPage - 1))}
    >
      {previousLabel}
    </a>
    {#each items as item}
      {#if item === "ellipsis"}
        <span class="inline-flex h-9 min-w-9 items-center justify-center px-2 text-base-content/50 text-sm">...</span>
      {:else}
        <a
          aria-current={item === currentPage ? "page" : undefined}
          class={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm shadow-sm transition-colors hover:bg-base-200 ${item === currentPage ? "border-primary bg-primary text-primary-content" : "border-base-300 bg-base-100"}`}
          href={getPageHref(item)}
        >
          {item}
        </a>
      {/if}
    {/each}
    <a
      aria-disabled={currentPage >= totalPages}
      aria-label={nextAriaLabel}
      class={`inline-flex h-9 items-center justify-center rounded-lg border border-base-300 bg-base-100 px-3 text-sm shadow-sm transition-colors hover:bg-base-200 ${currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}`}
      href={getPageHref(Math.min(totalPages, currentPage + 1))}
    >
      {nextLabel}
    </a>
  </nav>
{/if}
