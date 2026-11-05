import type { SubmitFunction } from "$app/forms";

type Attempt = {
  resolve: (success: boolean) => void;
  controller?: AbortController;
  onAbort?: () => void;
};
/** Each confirmation owns its settlement; a retired callback cannot settle a new request. */
export function createSubscriptionConfirmationAction(
  action: () => SubmitFunction,
) {
  let active: Attempt | undefined;
  let disposed = false;
  function finish(attempt: Attempt, success: boolean) {
    if (active !== attempt) return;
    active = undefined;
    if (attempt.onAbort)
      attempt.controller?.signal.removeEventListener("abort", attempt.onAbort);
    attempt.resolve(success);
  }
  const submit: SubmitFunction = async (input) => {
    const attempt = active;
    if (!attempt || disposed) {
      input.cancel();
      return;
    }
    attempt.controller = input.controller;
    attempt.onAbort = () => finish(attempt, false);
    input.controller.signal.addEventListener("abort", attempt.onAbort, {
      once: true,
    });
    let cancelled = false;
    try {
      const callback = await action()({
        ...input,
        cancel: () => {
          cancelled = true;
          input.cancel();
          finish(attempt, false);
        },
      });
      if (cancelled) return;
      return async (result) => {
        // The response is definitive before update() can unmount a redirected page.
        const success =
          result.result.type === "success" || result.result.type === "redirect";
        if (success) finish(attempt, true);
        try {
          if (callback) await callback(result);
          else await result.update({ navigate: false, reset: false });
          if (!success) finish(attempt, false);
        } catch (error) {
          finish(attempt, false);
          throw error;
        }
      };
    } catch (error) {
      finish(attempt, false);
      throw error;
    }
  };
  return {
    submit,
    confirm(form: Pick<HTMLFormElement, "requestSubmit">) {
      return new Promise<boolean>((resolve, reject) => {
        if (disposed || active) {
          resolve(false);
          return;
        }
        const attempt: Attempt = { resolve };
        active = attempt;
        try {
          form.requestSubmit();
        } catch (error) {
          active = undefined;
          reject(error);
        }
      });
    },
    dispose() {
      disposed = true;
      const attempt = active;
      if (attempt) {
        attempt.controller?.abort();
        finish(attempt, false);
      }
    },
  };
}
