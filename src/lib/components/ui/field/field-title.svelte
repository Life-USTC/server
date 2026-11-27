<script lang="ts">
  import StyledDiv, { type DivProps } from "../StyledDiv.svelte";
  let { ref = $bindable(null), ...props }: DivProps = $props();
</script>

<StyledDiv
  data-slot="field-label"
  {...props}
  bind:ref
  baseClass="gap-2 text-sm leading-snug font-medium group-data-[disabled=true]/field:opacity-50 flex w-fit items-center leading-snug"
/>
