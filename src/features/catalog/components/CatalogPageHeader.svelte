<script lang="ts">
import PageHeader from "$lib/components/PageHeader.svelte";

export let description: string;
export let title: string;
</script>

<PageHeader {title} {description} />
