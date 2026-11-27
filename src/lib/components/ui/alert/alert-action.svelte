<script lang="ts">
  import StyledDiv, { type DivProps } from "../StyledDiv.svelte";
  let { ref = $bindable(null), ...props }: DivProps = $props();
</script>

<StyledDiv
  data-slot="alert-action"
  {...props}
  bind:ref
  baseClass="absolute top-2 right-2"
/>
