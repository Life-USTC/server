<script lang="ts">
import ArrowLeft from "@lucide/svelte/icons/arrow-left";
import ArrowRight from "@lucide/svelte/icons/arrow-right";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import type { WelcomeCopy } from "./welcome-component-types";

export let backUrl: string | null;
export let importMessage: string;
export let nextUrl: string;
export let onOpenBulkImport: () => void;
export let welcomeCopy: WelcomeCopy;
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{welcomeCopy.nextStepsTitle}</Card.Title>
    <Card.Description>{welcomeCopy.nextStepsDescription}</Card.Description>
  </Card.Header>
  <Card.Content class="grid gap-2">
    {#if importMessage}
      <Alert.Root>
        <Alert.Description>{importMessage}</Alert.Description>
      </Alert.Root>
    {/if}
    <Button class="justify-start" type="button" onclick={onOpenBulkImport}>{welcomeCopy.bulkImportCta}</Button>
    <Button class="justify-start" href="/catalog/sections" variant="outline">{welcomeCopy.browseSections}</Button>
    <Button class="justify-start" href="/catalog/courses" variant="outline">{welcomeCopy.browseCourses}</Button>
  </Card.Content>
  <Card.Footer class="flex flex-wrap justify-between gap-2">
    {#if backUrl}
      <Button href={backUrl} variant="ghost">
        <ArrowLeft data-icon="inline-start" />
        {welcomeCopy.back}
      </Button>
    {/if}
    <Button class="ms-auto" href={nextUrl} variant="secondary">
      {welcomeCopy.skipForNow}
      <ArrowRight data-icon="inline-end" />
    </Button>
  </Card.Footer>
</Card.Root>
