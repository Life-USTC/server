<script lang="ts">
import LayoutGrid from "@lucide/svelte/icons/layout-grid";
import List from "@lucide/svelte/icons/list";
import Plus from "@lucide/svelte/icons/plus";
import type {
  DashboardTodosCopy,
  TodoFilter,
  TodoView,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { Button } from "$lib/components/ui/button/index.js";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
import DashboardTaskViewMenu from "./DashboardTaskViewMenu.svelte";

export let createTodoError: string;
export let setTodoView: (view: TodoView) => void;
export let showCreateTodo: boolean;
export let todoFilter: TodoFilter;
export let todosCopy: DashboardTodosCopy;
export let todoView: TodoView;
</script>

<div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
  <div class="min-w-0 md:flex md:flex-wrap md:items-center md:gap-2 md:justify-start">
    <ToggleGroup.Root
      aria-label={String(todosCopy.viewMode)}
      class="hidden md:flex"
      type="single"
      value={todoView}
      variant="outline"
      onValueChange={(value) => {
        if (value === "cards" || value === "list") setTodoView(value);
      }}
    >
      <ToggleGroup.Item value="cards">
        <LayoutGrid data-icon="inline-start" />
        {todosCopy.cardView}
      </ToggleGroup.Item>
      <ToggleGroup.Item value="list">
        <List data-icon="inline-start" />
        {todosCopy.listView}
      </ToggleGroup.Item>
    </ToggleGroup.Root>
    <ToggleGroup.Root
      aria-label={String(todosCopy.title)}
      class="w-full min-w-0 md:w-fit"
      type="single"
      value={todoFilter}
      variant="outline"
      onValueChange={(value) => {
        if (
          value === "incomplete" ||
          value === "completed" ||
          value === "all"
        ) {
          todoFilter = value;
        }
      }}
    >
      <ToggleGroup.Item class="h-11 min-w-0 flex-1 text-xs md:h-8 md:flex-none md:text-sm" value="incomplete">
        {todosCopy.filterIncomplete}
      </ToggleGroup.Item>
      <ToggleGroup.Item class="h-11 min-w-0 flex-1 text-xs md:h-8 md:flex-none md:text-sm" value="completed">
        {todosCopy.filterCompleted}
      </ToggleGroup.Item>
      <ToggleGroup.Item class="h-11 min-w-0 flex-1 text-xs md:h-8 md:flex-none md:text-sm" value="all">
        {todosCopy.filterAll}
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  </div>
  <div class="flex items-center gap-2 md:justify-end">
    <DashboardTaskViewMenu
      cardLabel={String(todosCopy.cardView)}
      label={String(todosCopy.viewMode)}
      listLabel={String(todosCopy.listView)}
      setView={setTodoView}
      testId="dashboard-todos-view-menu"
      view={todoView}
    />
    <Button
      aria-label={String(todosCopy.addButton)}
      class="size-11 md:h-9 md:w-auto md:min-w-28"
      data-testid="dashboard-todos-add"
      type="button"
      onclick={() => {
        createTodoError = "";
        showCreateTodo = true;
      }}
    >
      <Plus class="md:hidden" />
      <span class="hidden md:inline">{todosCopy.addButton}</span>
    </Button>
  </div>
</div>
