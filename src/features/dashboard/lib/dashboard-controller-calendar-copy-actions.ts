type CalendarCopyLabels = {
  linkCopied: string;
  linkCopiedDescription: string;
  optOutRetry: string;
};

export function createDashboardCalendarCopyActions(input: {
  getCopyLabels: () => CalendarCopyLabels;
  setCalendarCopyError: (value: string) => void;
  setCalendarCopyMessage: (value: string) => void;
}) {
  async function copyCalendarLink(event: MouseEvent) {
    const target = event.currentTarget as HTMLButtonElement;
    const url = target.dataset.copyUrl;
    if (!url) return;
    input.setCalendarCopyMessage("");
    input.setCalendarCopyError("");
    const labels = input.getCopyLabels();
    try {
      const fullUrl = url.startsWith("http")
        ? url
        : `${window.location.origin}${url}`;
      await navigator.clipboard.writeText(fullUrl);
      input.setCalendarCopyMessage(
        `${labels.linkCopied}: ${labels.linkCopiedDescription}`,
      );
    } catch {
      input.setCalendarCopyError(labels.optOutRetry);
    }
  }

  return {
    copyCalendarLink,
  };
}
