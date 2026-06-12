<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import type { CommentsCopy } from "./comment-component-types";

export let commentCopy: CommentsCopy;
export let hiddenCount: number;
export let signInHref: string;
</script>

<Alert>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <span>{commentCopy.hiddenNotice.replace("{count}", String(hiddenCount))}</span>
    <Button href={signInHref} size="sm" variant="outline">
      {commentCopy.loginToView}
    </Button>
  </div>
</Alert>
