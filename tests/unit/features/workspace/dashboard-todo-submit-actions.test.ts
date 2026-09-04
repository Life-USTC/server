import { describe, expect, test, vi } from "vitest";
import { updateTodoSubmitAction } from "@/features/workspace/lib/todo-submit-actions";

describe("updateTodoSubmitAction", () => {
  test("closes the editor after the successful update has refreshed page data", async () => {
    const events: string[] = [];
    const onClose = vi.fn(() => events.push("close"));
    const setError = vi.fn();
    const setUpdating = vi.fn();
    const submit = updateTodoSubmitAction({
      actionResultError: vi.fn(),
      fallbackMessage: "save failed",
      onClose,
      setError,
      setUpdating,
      validate: () => "",
    });

    const callback = submit({
      cancel: vi.fn(),
      formData: new FormData(),
    });
    expect(callback).toBeTypeOf("function");
    if (!callback) throw new Error("expected an enhanced form callback");

    await callback({
      result: { type: "success" },
      update: async () => {
        events.push("update");
      },
    });

    expect(events).toEqual(["update", "close"]);
    expect(onClose).toHaveBeenCalledOnce();
    expect(setError).toHaveBeenLastCalledWith("");
    expect(setUpdating.mock.calls).toEqual([[true], [false]]);
  });

  test("keeps the editor open when the update fails", async () => {
    const onClose = vi.fn();
    const setError = vi.fn();
    const submit = updateTodoSubmitAction({
      actionResultError: () => "server error",
      fallbackMessage: "save failed",
      onClose,
      setError,
      setUpdating: vi.fn(),
      validate: () => "",
    });
    const callback = submit({
      cancel: vi.fn(),
      formData: new FormData(),
    });
    if (!callback) throw new Error("expected an enhanced form callback");

    await callback({
      result: { type: "failure" },
      update: vi.fn(),
    });

    expect(setError).toHaveBeenLastCalledWith("server error");
    expect(onClose).not.toHaveBeenCalled();
  });
});
