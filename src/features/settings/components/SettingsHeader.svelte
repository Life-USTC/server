<script lang="ts">
import PageHeader from "$lib/components/PageHeader.svelte";
import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
import type { SettingsCopy } from "./settings-component-types";

export let copy: SettingsCopy;
</script>

<PageHeader
  title={copy.settings.title}
  description={copy.settings.description}
  eyebrow={copy.settings.workspaceBadge}
>
  {#snippet breadcrumb()}
    <Breadcrumb.Root>
      <Breadcrumb.List>
        <Breadcrumb.Item><Breadcrumb.Link href="/">{copy.common.home}</Breadcrumb.Link></Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item><Breadcrumb.Page>{copy.settings.title}</Breadcrumb.Page></Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb.Root>
  {/snippet}
</PageHeader>
