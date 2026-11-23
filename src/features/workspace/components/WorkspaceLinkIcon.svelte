<script lang="ts">
import BookOpen from "@lucide/svelte/icons/book-open";
import Building from "@lucide/svelte/icons/building";
import ClipboardList from "@lucide/svelte/icons/clipboard-list";
import GraduationCap from "@lucide/svelte/icons/graduation-cap";
import Mail from "@lucide/svelte/icons/mail";
import MonitorPlay from "@lucide/svelte/icons/monitor-play";
import Network from "@lucide/svelte/icons/network";
import School from "@lucide/svelte/icons/school";
import Users from "@lucide/svelte/icons/users";
import Link from "@lucide/svelte/icons/link";

let { name }: { name: string } = $props();
const icons = new Map([
  ["book-open", BookOpen],
  ["building", Building],
  ["clipboard-list", ClipboardList],
  ["graduation-cap", GraduationCap],
  ["mail", Mail],
  ["monitor-play", MonitorPlay],
  ["network", Network],
  ["school", School],
  ["users", Users],
]);
const Icon = $derived(icons.get(name) ?? Link);
</script>

<Icon aria-hidden="true" class="size-4 shrink-0" />
