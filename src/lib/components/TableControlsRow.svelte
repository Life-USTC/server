<script lang="ts">
import type { Snippet } from "svelte";
import * as Table from "#lib/components/ui/table/index.js";

let { colspan, children }: { colspan: number; children: Snippet } = $props();
</script>

<Table.Row data-slot="table-controls-row">
  <Table.Head {colspan} scope="colgroup" class="whitespace-normal py-3">
    <div class="flex min-w-0 flex-wrap items-center gap-2">
      {@render children()}
    </div>
  </Table.Head>
</Table.Row>
