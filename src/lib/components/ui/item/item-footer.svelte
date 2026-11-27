<script lang="ts">
  import StyledDiv, { type DivProps } from "../StyledDiv.svelte";
  let { ref = $bindable(null), ...props }: DivProps = $props();
</script>

<StyledDiv
  data-slot="item-footer"
  {...props}
  bind:ref
  baseClass="gap-2 flex basis-full items-center justify-between"
/>
