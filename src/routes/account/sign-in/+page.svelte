<script lang="ts">
import SignInPage from "@/features/auth/components/SignInPage.svelte";
import type { ActionData, PageData } from "./$types";

export let data: PageData;
export let form: ActionData;
</script>

<SignInPage {data} {form} />
