<script lang="ts">
import { signInHrefForPage } from "#lib/auth/auth-routing.js";
import { Button, type ButtonProps } from "#lib/components/ui/button/index.js";
import { page } from "$app/state";

let props: Omit<ButtonProps, "href"> = $props();
</script>

<Button {...props} href={signInHrefForPage(page.url)} />
