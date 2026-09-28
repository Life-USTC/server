<script lang="ts">
import ProfileView from "@/features/profile/components/ProfileView.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<svelte:head>
  <title>{data.socialMetadata.title}</title>
</svelte:head>

<ProfileView profile={data} />
