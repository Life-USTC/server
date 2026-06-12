<script lang="ts">
type BadgeVariant = "default" | "secondary" | "outline" | "ghost";

const _variants: Record<BadgeVariant, string> = {
  default: "border-transparent bg-primary text-primary-content",
  secondary: "border-primary/25 bg-primary/10 text-primary",
  outline: "border-base-300 bg-base-100 text-base-content",
  ghost: "border-transparent bg-base-200/70 text-base-content/70",
};

export let variant: BadgeVariant = "default";
let className = "";

export { className as class };
</script>

<span
  class={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-xs leading-5 ${_variants[variant]} ${className}`}
  data-slot="badge"
  {...$$restProps}
>
  <slot />
</span>
