<script lang="ts">
import PageHeader from "$lib/components/PageHeader.svelte";
import type { SettingsCopy } from "./settings-component-types";

export let copy: SettingsCopy;
</script>

<PageHeader
  title={copy.settings.title}
  description={copy.settings.description}
  eyebrow={copy.settings.workspaceBadge}
/>
