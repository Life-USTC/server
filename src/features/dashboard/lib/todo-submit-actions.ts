type ActionResult = {
  data?: { error?: unknown };
  type: string;
};

export function createTodoSubmitAction({
  fallbackMessage,
  onClose,
  setCreating,
  setError,
  validate,
  actionResultError,
}: {
  fallbackMessage: string;
  onClose: () => void;
  setCreating: (value: boolean) => void;
  setError: (value: string) => void;
  validate: (formData: FormData) => string;
  actionResultError: (result: ActionResult, fallback: string) => string;
}) {
  return ({ cancel, formData }: { cancel: () => void; formData: FormData }) => {
    const error = validate(formData);
    setError(error);
    if (error) {
      cancel();
      return;
    }
    setCreating(true);
    return async ({
      result,
      update,
    }: {
      result: ActionResult;
      update: () => Promise<void>;
    }) => {
      try {
        if (result.type === "failure") {
          setError(actionResultError(result, fallbackMessage));
          return;
        }
        await update();
        setError("");
        onClose();
      } finally {
        setCreating(false);
      }
    };
  };
}

export function updateTodoSubmitAction({
  fallbackMessage,
  setError,
  setUpdating,
  validate,
  actionResultError,
}: {
  fallbackMessage: string;
  setError: (value: string) => void;
  setUpdating: (value: boolean) => void;
  validate: (formData: FormData) => string;
  actionResultError: (result: ActionResult, fallback: string) => string;
}) {
  return ({ cancel, formData }: { cancel: () => void; formData: FormData }) => {
    const error = validate(formData);
    setError(error);
    if (error) {
      cancel();
      return;
    }
    setUpdating(true);
    return async ({
      result,
      update,
    }: {
      result: ActionResult;
      update: () => Promise<void>;
    }) => {
      try {
        if (result.type === "failure") {
          setError(actionResultError(result, fallbackMessage));
          return;
        }
        await update();
      } finally {
        setUpdating(false);
      }
    };
  };
}
