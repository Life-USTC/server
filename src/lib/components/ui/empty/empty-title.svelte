<script lang="ts">
  import StyledDiv, { type DivProps } from "../StyledDiv.svelte";
  let { ref = $bindable(null), ...props }: DivProps = $props();
</script>

<StyledDiv
  data-slot="empty-title"
  {...props}
  bind:ref
  baseClass="text-sm font-medium tracking-tight"
/>
