import type { Page } from "@playwright/test";
import { createDeferred } from "../../shared/deferred";

type Outcome = { ok: true } | { ok: false; error: unknown };
type BrowserWorkflow = {
  run: (work: () => Promise<void>) => Promise<void>;
  body: (work: () => Promise<void>) => Promise<void>;
};

function containsError(parent: unknown, error: unknown): boolean {
  return (
    parent === error ||
    (parent instanceof AggregateError &&
      parent.errors.some((child) => containsError(child, error)))
  );
}

/** End the wrapper's wait on interruption, then join the real body after its
 * existing write/effect finalizer closes the page. Never abort a submitted write
 * merely to release a browser callback that is waiting for page closure. */
export async function withBrowserWorkflow(
  page: Page,
  use: (workflow: BrowserWorkflow) => Promise<void>,
) {
  const interrupted = createDeferred();
  const bodies: Promise<Outcome>[] = [];
  const errors: unknown[] = [];
  let operation: Promise<void> | undefined;
  let closing = false;
  let interruption: Error | undefined;
  const interruptionError = () =>
    (interruption ??= new Error(
      "Browser workflow interrupted after fixture use ended",
    ));
  const remember = (error: unknown) => {
    if (!errors.some((existing) => containsError(existing, error)))
      errors.push(error);
  };

  try {
    await use({
      run(work) {
        if (closing || operation)
          return Promise.reject(
            new Error("Browser workflow is already owned or closing"),
          );
        operation = Promise.resolve().then(async () => {
          const failures: unknown[] = [];
          try {
            if (closing) throw interruptionError();
            await work();
          } catch (error) {
            failures.push(error);
          } finally {
            closing = true;
            // The domain wrapper has finished its write/effect finalizer.
            // Failed preparation can still leave its page open.
            if (!page.isClosed())
              try {
                await page.close();
              } catch (error) {
                failures.push(error);
              }
            // The public run promise owns the actual callbacks too. Reporting
            // only the wrapper's interruption would lose their original errors.
            for (let index = 0; index < bodies.length; index++) {
              const result = await bodies[index];
              if (
                !result.ok &&
                !failures.some((error) => containsError(error, result.error))
              )
                failures.push(result.error);
            }
          }
          if (failures.length === 1) throw failures[0];
          if (failures.length)
            throw new AggregateError(
              failures,
              "Browser workflow and callback failed",
            );
        });
        // The runner can end use() before this promise rejects. Keep its actual
        // outcome for the final join without an unhandled rejection meanwhile.
        void operation.catch(() => undefined);
        return operation;
      },
      body(work) {
        const body = Promise.resolve().then(() => {
          if (closing) throw interruptionError();
          return work();
        });
        bodies.push(
          body.then(
            () => ({ ok: true as const }),
            (error: unknown) => ({ ok: false as const, error }),
          ),
        );
        // This only releases the domain wrapper into its existing finally.
        // The original callback is still owned and joined below, not discarded.
        return Promise.race([
          body,
          interrupted.promise.then(() => {
            throw interruptionError();
          }),
        ]);
      },
    });
  } catch (error) {
    remember(error);
  } finally {
    closing = true;
    interrupted.resolve();
    try {
      await operation;
    } catch (error) {
      remember(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length)
    throw new AggregateError(
      errors,
      "Browser workflow and finalization failed",
    );
}
