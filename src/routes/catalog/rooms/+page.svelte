<script lang="ts">
import RoomMapLookupPage from "@/features/catalog/components/RoomMapLookupPage.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<RoomMapLookupPage
  copy={data.copy}
  initialRoom={data.initialRoom}
/>
