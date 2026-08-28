import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WelcomeBulkImportActionInput } from "@/features/welcome/lib/welcome-bulk-import-action-types";
import { createWelcomeBulkImportActions } from "@/features/welcome/lib/welcome-bulk-import-actions";
import { createWelcomeControllerDefaultState } from "@/features/welcome/lib/welcome-controller-default-state";
import { formatWelcomeCopy } from "@/features/welcome/lib/welcome-display";

const extractSubscriptionSectionCodes = vi.fn();
const matchSubscriptionSectionCodes = vi.fn();
const appendSubscribedSectionIds = vi.fn();

vi.mock("@/features/subscriptions/lib/subscription-import-client", () => ({
  extractSubscriptionSectionCodes: (...args: unknown[]) =>
    extractSubscriptionSectionCodes(...args),
  matchSubscriptionSectionCodes: (...args: unknown[]) =>
    matchSubscriptionSectionCodes(...args),
  appendSubscribedSectionIds: (...args: unknown[]) =>
    appendSubscribedSectionIds(...args),
}));

function createInput() {
  const state = createWelcomeControllerDefaultState({
    defaultSemesterId: 7,
  });
  state.importText = "001013.01";

  const input: WelcomeBulkImportActionInput = {
    formatCopy: formatWelcomeCopy,
    getBulkCopy: () => ({
      checkFormat: "check format",
      fetchFailed: "fetch failed",
      importFailed: "import failed",
      noValidCodes: "no valid codes",
    }),
    getImportText: () => state.importText,
    getLocale: () => "zh-cn",
    getSelectedSectionIds: () => state.selectedSectionIds,
    getSelectedSemesterId: () => state.selectedSemesterId,
    getWelcomeCopy: () => ({
      importedSummary: "Added {count} sections.",
      noMatchingSections: "No matching sections were found.",
    }),
    setImportError: (value) => {
      state.importError = value;
    },
    setImporting: (value) => {
      state.isImporting = value;
    },
    setImportMessage: (value) => {
      state.importMessage = value;
    },
    setImportText: (value) => {
      state.importText = value;
    },
    setMatchedSections: (value) => {
      state.matchedSections = value;
    },
    setMatching: (value) => {
      state.isMatching = value;
    },
    setResultsVisible: (value) => {
      state.areResultsVisible = value;
    },
    setSelectedSectionIds: (value) => {
      state.selectedSectionIds = value;
    },
    setUnmatchedCodes: (value) => {
      state.unmatchedCodes = value;
    },
  };

  return { input, state };
}

describe("欢迎流程批量导入", () => {
  beforeEach(() => {
    extractSubscriptionSectionCodes.mockReset();
    matchSubscriptionSectionCodes.mockReset();
    appendSubscribedSectionIds.mockReset();
  });

  it("默认不展示匹配结果", () => {
    const state = createWelcomeControllerDefaultState({});
    expect(state.areResultsVisible).toBe(false);
  });

  it("没有有效代码时只显示错误、不打开结果区", async () => {
    extractSubscriptionSectionCodes.mockReturnValue([]);
    const { input, state } = createInput();
    const { matchSections } = createWelcomeBulkImportActions(input);

    await matchSections();

    expect(state.areResultsVisible).toBe(false);
    expect(state.importError).toContain("no valid codes");
    expect(matchSubscriptionSectionCodes).not.toHaveBeenCalled();
  });

  it("匹配成功后在当前步骤内展示结果", async () => {
    extractSubscriptionSectionCodes.mockReturnValue(["001013.01"]);
    matchSubscriptionSectionCodes.mockResolvedValue({
      sections: [
        {
          id: 11,
          code: "001013.01",
          course: { nameCn: "线性代数" },
          teachers: [],
        },
      ],
      unmatchedCodes: [],
    });
    const { input, state } = createInput();
    const { matchSections } = createWelcomeBulkImportActions(input);

    await matchSections();

    expect(state.areResultsVisible).toBe(true);
    expect(state.selectedSectionIds).toEqual([11]);
    expect(state.matchedSections).toHaveLength(1);
  });

  it("确认导入后收起结果并提示新增数量", async () => {
    appendSubscribedSectionIds.mockResolvedValue(2);
    const { input, state } = createInput();
    state.areResultsVisible = true;
    state.selectedSectionIds = [11, 12];
    const { confirmImport } = createWelcomeBulkImportActions(input);

    await confirmImport();

    expect(appendSubscribedSectionIds).toHaveBeenCalledWith({
      importFailedMessage: "import failed",
      selectedSectionIds: [11, 12],
    });
    expect(state.areResultsVisible).toBe(false);
    expect(state.importText).toBe("");
    expect(state.importMessage).toBe("Added 2 sections.");
  });
});
