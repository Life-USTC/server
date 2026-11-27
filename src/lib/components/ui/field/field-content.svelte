<script lang="ts">
  import StyledDiv, { type DivProps } from "../StyledDiv.svelte";
  let { ref = $bindable(null), ...props }: DivProps = $props();
</script>

<StyledDiv
  data-slot="field-content"
  {...props}
  bind:ref
  baseClass="gap-0.5 group/field-content flex flex-1 flex-col leading-snug"
/>
