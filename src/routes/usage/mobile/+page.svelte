<script lang="ts">
import MobileAppPage from "@/features/mobile-app/components/MobileAppPage.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<MobileAppPage {data} />
