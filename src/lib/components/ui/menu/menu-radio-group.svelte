<script lang="ts">
import { DropdownMenu as MenuPrimitive } from "bits-ui";

let { value, ...restProps }: MenuPrimitive.RadioGroupProps = $props();
</script>

<MenuPrimitive.RadioGroup {value} {...restProps} />
