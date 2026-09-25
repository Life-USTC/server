export function formAlertVariant(kind: unknown) {
  return kind === "error" ? "destructive" : "default";
}
