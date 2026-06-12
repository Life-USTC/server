<script lang="ts">
import { Pagination } from "$lib/components/ui/pagination/index.js";

export let commonLabels: {
  next: string;
  nextPage: string;
  pagination: string;
  previous: string;
  previousPage: string;
};
export let getPageHref: (page: number) => string;
export let page: number;
export let totalPages: number;
</script>

<Pagination
  currentPage={page}
  {getPageHref}
  label={commonLabels.pagination}
  nextAriaLabel={commonLabels.nextPage}
  nextLabel={commonLabels.next}
  previousAriaLabel={commonLabels.previousPage}
  previousLabel={commonLabels.previous}
  {totalPages}
/>
