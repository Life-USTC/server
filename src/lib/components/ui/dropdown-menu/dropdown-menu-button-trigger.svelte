<script lang="ts">
import { MenuTrigger } from "@ui-sdk/svelte/menu";
import { Button, type ButtonProps } from "#lib/components/ui/button/index.js";

let button: Omit<ButtonProps, "ref"> = $props();
</script>

<MenuTrigger>
  {#snippet render({ props })}
    <Button {...props} {...button} />
  {/snippet}
</MenuTrigger>
