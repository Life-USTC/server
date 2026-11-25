<script lang="ts">
  import StyledDiv, { type DivProps } from "../StyledDiv.svelte";
  let { ref = $bindable(null), ...props }: DivProps = $props();
</script>

<StyledDiv
  data-slot="sheet-header"
  {...props}
  bind:ref
  baseClass="gap-0.5 p-4 flex flex-col"
/>
