import { describe, expect, it } from "vitest";
import {
  taskFilterSummary,
  withoutTaskFilter,
} from "@/features/workspace/lib/workspace-task-filter-state";
import messages from "../../messages/en-us.json";

describe("task filter applied intent", () => {
  it("removes the selected condition and all comparison bounds while retaining unrelated drafts", () => {
    const draft = {
      title: "unsubmitted",
      dueAt: "2030-01-01",
      dueAtOp: "between",
      dueAtMax: "2030-02-01",
      completion: "incomplete,completed",
    };
    const applied = { title: "submitted", dueAt: "2029-01-01", dueAtOp: "gte" };
    expect(withoutTaskFilter(draft, "dueAt")).toEqual({
      title: "unsubmitted",
      completion: "incomplete,completed",
    });
    expect(withoutTaskFilter(applied, "dueAt")).toEqual({ title: "submitted" });
    expect(draft.dueAtOp).toBe("between");
  });
  it("summarizes applied multiselect OR choices and inclusive comparison bounds without hiding unknown values", () => {
    expect(
      taskFilterSummary(
        {
          name: "priority",
          label: "Priority",
          options: [{ value: "high", label: "High" }],
        },
        { priority: "high,medium" },
        messages.common.tableFilters,
      ),
    ).toBe("High, medium");
    expect(
      taskFilterSummary(
        { name: "dueAt", label: "Due date", type: "date" },
        { dueAt: "2030-01-01", dueAtOp: "between", dueAtMax: "2030-02-01" },
        messages.common.tableFilters,
      ),
    ).toBe("Between (inclusive) 2030-01-01 – 2030-02-01");
    expect(
      taskFilterSummary(
        { name: "title", label: "Title" },
        { title: "  " },
        messages.common.tableFilters,
      ),
    ).toBeNull();
  });
});
