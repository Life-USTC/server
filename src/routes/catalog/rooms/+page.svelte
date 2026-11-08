<script lang="ts">
import RoomMapLookupPage from "@/features/catalog/components/RoomMapLookupPage.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<RoomMapLookupPage
  pageDemo={data.demo}
  locale={data.locale}
  buildings={data.buildings}
  copy={data.copy}
  initialRoom={data.initialRoom}
/>
