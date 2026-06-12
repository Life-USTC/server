import { writeClipboardText } from "@/lib/browser/clipboard";

type CalendarCopyTarget = "single" | "subscription";

export function createSectionCalendarClipboardActions(input: {
  getCopiedMessage: () => string;
  getFailureMessage: () => string;
  setCalendarDialogOpen: (value: boolean) => void;
  setClipboardError: (value: string) => void;
  setClipboardMessage: (value: string) => void;
  setCopiedCalendarTarget: (value: CalendarCopyTarget | null) => void;
}) {
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  function resetClipboardState() {
    input.setClipboardMessage("");
    input.setClipboardError("");
    input.setCopiedCalendarTarget(null);
  }

  function openCalendarDialog() {
    resetClipboardState();
    input.setCalendarDialogOpen(true);
  }

  async function copyText(value: string, target: CalendarCopyTarget) {
    resetClipboardState();
    if (!value) {
      input.setClipboardError(input.getFailureMessage());
      return;
    }
    try {
      await writeClipboardText(value);
      input.setClipboardMessage(input.getCopiedMessage());
      input.setCopiedCalendarTarget(target);
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        input.setClipboardMessage("");
        input.setCopiedCalendarTarget(null);
        resetTimer = null;
      }, 2000);
    } catch {
      input.setClipboardError(input.getFailureMessage());
    }
  }

  function clearClipboardTimer() {
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
  }

  return {
    clearClipboardTimer,
    copyText,
    openCalendarDialog,
  };
}
