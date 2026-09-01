<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import type { PublicationPageCopy } from "./publication-component-types";

export let type: "news" | "notice";
export let copy: Pick<PublicationPageCopy, "news" | "notice">;
</script>

<Badge variant={type === "news" ? "default" : "secondary"}>
  {type === "news" ? copy.news : copy.notice}
</Badge>
