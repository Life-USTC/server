import { withBrowserWorkflow } from "./browser-workflow";
import {
  type HomeworkEffectContext,
  type HomeworkEffects,
  withHomeworkEffects,
} from "./homework-effects";
import { test as workerTest } from "./owned-worker";

// The two catalog presentation journeys also perform real subscription writes.
// Reuse the existing calendar consumer/effect owner with explicit expectations.
export const test = workerTest.extend<{
  catalogSubscriptionRun: (
    account: { id: string },
    expected: HomeworkEffects,
    work: (effects: HomeworkEffectContext) => Promise<void>,
  ) => Promise<void>;
}>({
  catalogSubscriptionRun: async (
    { page, isolatedWorker, run },
    use,
    testInfo,
  ) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((account, expected, work) =>
        workflow.run(() =>
          run(() =>
            withHomeworkEffects(
              {
                page,
                isolatedWorker,
                account,
                testInfo,
                observeReads: true,
                runBody: workflow.body,
                ...expected,
              },
              work,
            ),
          ),
        ),
      );
    });
  },
});
