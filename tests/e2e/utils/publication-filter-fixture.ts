import { type PreferenceFlow, withPreferenceFlow } from "./preference-flow";
import { test as publicationTest } from "./publication-fixture";

/** Retain the existing publication arranger while owning held native GET reads. */
export const test = publicationTest.extend<{ filterFlow: PreferenceFlow }>({
  filterFlow: async ({ page, browser, request, isolatedWorker, run }, use) => {
    await run(() =>
      withPreferenceFlow(
        { page, browser, observer: request, isolatedWorker },
        use,
      ),
    );
  },
});
