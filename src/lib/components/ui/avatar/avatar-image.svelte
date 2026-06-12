<script lang="ts">
export let alt = "";
export let src: string;
let className = "";

export { className as class };
</script>

<img
  class={`aspect-square h-full w-full object-cover ${className}`}
  data-slot="avatar-image"
  {alt}
  {src}
  {...$$restProps}
/>
