<script lang="ts">
import * as Card from "$lib/components/ui/card/index.js";
import { Skeleton } from "$lib/components/ui/skeleton/index.js";
</script>

<Card.Root>
  <Card.Header>
    <div class="grid gap-2">
      <Skeleton class="h-5 w-32" />
      <Skeleton class="h-4 w-56 max-w-full" />
    </div>
    <Card.Action>
      <Skeleton class="h-9 w-24" />
    </Card.Action>
  </Card.Header>
  <Card.Content class="grid gap-4">
    <Skeleton class="h-36 w-full" />
    <div class="flex justify-end gap-2">
      <Skeleton class="h-9 w-24" />
      <Skeleton class="h-9 w-20" />
    </div>
  </Card.Content>
</Card.Root>
