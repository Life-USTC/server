<script lang="ts">
let className = "";

export { className as class };
</script>

<div class={`flex items-center p-5 pt-0 ${className}`} data-slot="card-footer" {...$$restProps}>
  <slot />
</div>
