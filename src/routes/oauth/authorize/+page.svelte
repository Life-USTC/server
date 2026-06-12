<script lang="ts">
import OAuthAuthorizePage from "@/features/oauth/components/OAuthAuthorizePage.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<OAuthAuthorizePage {data} />
