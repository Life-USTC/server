<script lang="ts">
import type { Snippet } from "svelte";

let { colspan, children }: { colspan: number; children: Snippet } = $props();
</script>

<tr data-slot="table-controls-row">
  <th {colspan} scope="colgroup" class="whitespace-normal py-3">
    <div class="flex min-w-0 flex-wrap items-center gap-2">
      {@render children()}
    </div>
  </th>
</tr>
