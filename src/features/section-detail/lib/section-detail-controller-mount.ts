import {
  initialSectionHomeworkViewFromBrowser,
  type SectionHomeworkView,
} from "./section-detail-controller-navigation";

export function mountSectionDetailController(input: {
  clearClipboardTimer: () => void;
  getHomeworkView: () => SectionHomeworkView;
  loadHomeworks: () => unknown;
  setHomeworkView: (view: SectionHomeworkView) => void;
  setOrigin: (origin: string) => void;
  shouldLoadHomeworks: boolean;
}) {
  input.setOrigin(window.location.origin);
  input.setHomeworkView(
    initialSectionHomeworkViewFromBrowser(input.getHomeworkView()),
  );
  if (input.shouldLoadHomeworks) {
    void input.loadHomeworks();
  }

  return () => {
    input.clearClipboardTimer();
  };
}
