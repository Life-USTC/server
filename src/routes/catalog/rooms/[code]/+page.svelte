<script lang="ts">
import CollectionPage from "#lib/components/CollectionPage.svelte";
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import RoomMapPreview from "@/features/rooms/components/RoomMapPreview.svelte";
import type { PageData } from "./$types";
export let data: PageData;
</script>

<svelte:head><title>{data.map.code} - Life@USTC</title></svelte:head>
<CollectionPage layout="detail" density="detail" title={data.map.code}>
  {#snippet eyebrowContent()}<a href={`/catalog/rooms?${new URLSearchParams({room: data.map.code})}`} class="text-sm text-muted-foreground">{data.copy.title}</a>{/snippet}
  {#if data.demo}<DemoNotice demo={data.demo} locale={data.locale} />{/if}
  <RoomMapPreview code={data.map.code} initialMap={data.map} copy={data.copy} locale={data.locale} pageDemo={data.demo} inline className="w-full" />
</CollectionPage>
