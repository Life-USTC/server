import type { SectionTab } from "./section-detail-controller-helpers";
import {
  initialSectionHomeworkViewFromBrowser,
  mountSectionDetailNavigation,
  type SectionHomeworkView,
} from "./section-detail-controller-navigation";

export function mountSectionDetailController(input: {
  clearClipboardTimer: () => void;
  getHomeworkView: () => SectionHomeworkView;
  loadHomeworks: () => unknown;
  setActiveTab: (tab: SectionTab) => void;
  setHomeworkView: (view: SectionHomeworkView) => void;
  setOrigin: (origin: string) => void;
}) {
  input.setOrigin(window.location.origin);
  input.setHomeworkView(
    initialSectionHomeworkViewFromBrowser(input.getHomeworkView()),
  );
  void input.loadHomeworks();

  const cleanupNavigation = mountSectionDetailNavigation({
    setActiveTabFromHash: (tab) => {
      input.setActiveTab(tab);
    },
  });

  return () => {
    input.clearClipboardTimer();
    cleanupNavigation();
  };
}
