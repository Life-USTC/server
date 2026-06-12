<script lang="ts">
import type {
  DashboardTodosCopy,
  TodoFilter,
  TodoView,
} from "@/features/dashboard/lib/dashboard-controller-types";
import LayoutGrid from "$lib/components/icons/layout-grid.svelte";
import List from "$lib/components/icons/list.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Tabs from "$lib/components/ui/tabs/index.js";

export let createTodoError: string;
export let setTodoView: (view: TodoView) => void;
export let showCreateTodo: boolean;
export let todoFilter: TodoFilter;
export let todosCopy: DashboardTodosCopy;
export let todoView: TodoView;
</script>

<div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
  <div class="flex flex-wrap items-center gap-2 md:justify-start">
    <Tabs.List aria-label={todosCopy.viewMode}>
      <Tabs.Button
        selected={todoView === "cards"}
        onclick={() => {
          setTodoView("cards");
        }}
      >
        <LayoutGrid />
        {todosCopy.cardView}
      </Tabs.Button>
      <Tabs.Button
        selected={todoView === "list"}
        onclick={() => {
          setTodoView("list");
        }}
      >
        <List />
        {todosCopy.listView}
      </Tabs.Button>
    </Tabs.List>
    <Tabs.List aria-label={todosCopy.title}>
      <Tabs.Button
        selected={todoFilter === "incomplete"}
        onclick={() => {
          todoFilter = "incomplete";
        }}
      >
        {todosCopy.filterIncomplete}
      </Tabs.Button>
      <Tabs.Button
        selected={todoFilter === "completed"}
        onclick={() => {
          todoFilter = "completed";
        }}
      >
        {todosCopy.filterCompleted}
      </Tabs.Button>
      <Tabs.Button
        selected={todoFilter === "all"}
        onclick={() => {
          todoFilter = "all";
        }}
      >
        {todosCopy.filterAll}
      </Tabs.Button>
    </Tabs.List>
  </div>
  <div class="flex flex-wrap items-center gap-2 md:justify-end">
    <Button
      class="h-9 min-w-28"
      type="button"
      onclick={() => {
        createTodoError = "";
        showCreateTodo = true;
      }}
    >
      {todosCopy.addButton}
    </Button>
  </div>
</div>
