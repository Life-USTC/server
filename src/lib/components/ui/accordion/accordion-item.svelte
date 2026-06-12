<script lang="ts">
export let open = false;
export let title: string;
let className = "";

export { className as class };
</script>

<details
  class={`rounded-xl border border-base-300 bg-base-100 p-3 ${className}`}
  data-slot="accordion-item"
  {open}
  {...$$restProps}
>
  <summary class="cursor-pointer font-medium text-sm" data-slot="accordion-trigger">
    {title}
  </summary>
  <div class="mt-3" data-slot="accordion-content">
    <slot />
  </div>
</details>
