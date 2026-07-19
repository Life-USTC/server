<script lang="ts">
export let code: string;
export let courseName: string;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let structuredDataJson: string;
export let titleTemplate: string;

$: pageTitle = formatMessage(titleTemplate, { code, name: courseName });
</script>

<svelte:head>
  <title>{pageTitle} - Life@USTC</title>
  {@html `<script type="application/ld+json">${structuredDataJson}</script>`}
</svelte:head>
