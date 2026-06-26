<script lang="ts">
export let active = false;
export let id: string;
export let labelledBy: string;
let className = "";

export { className as class };
</script>

<div
  aria-labelledby={labelledBy}
  class={className}
  data-slot="tabs-panel"
  hidden={!active}
  {id}
  role="tabpanel"
  tabindex="0"
  {...$$restProps}
>
  <slot />
</div>
