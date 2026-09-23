<script lang="ts">
import ProfileView from "@/features/profile/components/ProfileView.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<svelte:head>
  <title>{data.user.name ?? data.user.username ?? data.copy.publicProfile.idLabel} - Life@USTC</title>
</svelte:head>

<ProfileView profile={data} />
