export const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=no";

export function setContentSignal(headers: Headers) {
  headers.set("Content-Signal", CONTENT_SIGNAL);
}
