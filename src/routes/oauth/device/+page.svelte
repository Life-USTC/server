<script lang="ts">
import OAuthDevicePage from "@/features/oauth/components/OAuthDevicePage.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<OAuthDevicePage {data} />
