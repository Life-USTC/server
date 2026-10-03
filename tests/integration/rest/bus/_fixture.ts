import { test as workerTest } from "../../../e2e/utils/owned-worker";
import { arrangeBusTimetable } from "../../../shared/bus-timetable";

export const test = workerTest.extend<{ busTimetable: undefined }>({
  busTimetable: [
    async ({ isolatedWorker, run }, use) => {
      await run(() => arrangeBusTimetable(isolatedWorker.database.owner));
      await use(undefined);
    },
    { auto: true },
  ],
});
