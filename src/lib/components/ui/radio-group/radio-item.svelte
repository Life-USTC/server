<script lang="ts">
import { RadioGroup as RadioGroupPrimitive } from "bits-ui";

export let disabled = false;
export let value: string;
let className = "";

export { className as class };
</script>

<RadioGroupPrimitive.Item
  class={`cursor-pointer rounded-md border border-base-300 bg-base-100 p-1 transition hover:border-primary/70 data-[state=checked]:border-primary data-[state=checked]:ring-2 data-[state=checked]:ring-primary/25 ${className}`}
  data-slot="radio-item"
  type="button"
  {disabled}
  {value}
  {...$$restProps}
>
  <slot />
</RadioGroupPrimitive.Item>
