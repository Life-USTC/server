<script lang="ts">
import { RadioGroup as RadioGroupPrimitive } from "bits-ui";

export let disabled = false;
export let name: string | undefined = undefined;
export let required = false;
export let value = "";
export let onchange:
  | ((event: { currentTarget: { value: string } }) => void)
  | undefined = undefined;
let className = "";

export { className as class };

function handleValueChange(nextValue: string) {
  value = nextValue;
  onchange?.({ currentTarget: { value: nextValue } });
}
</script>

<fieldset class={`grid gap-3 ${className}`} {disabled} {...$$restProps}>
  <RadioGroupPrimitive.Root
    class="contents"
    {disabled}
    {name}
    {required}
    {value}
    onValueChange={handleValueChange}
  >
    <slot />
  </RadioGroupPrimitive.Root>
</fieldset>
