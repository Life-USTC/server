<script lang="ts">
import { DropdownMenu as MenuPrimitive } from "bits-ui";

let { open = $bindable(false), ...restProps }: MenuPrimitive.RootProps =
  $props();
</script>

<MenuPrimitive.Root bind:open {...restProps} />
