import { isRecord } from "@/lib/is-record";
import { compactMcpPayload } from "@/lib/mcp/compact-dispatch";
import { serializeDatesDeep } from "@/lib/time/serialize-date-output";
import { resolveMcpMode } from "./helper-schemas";

function toStructuredContent(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    return {
      ...value,
      success: typeof value.success === "boolean" ? value.success : true,
    };
  }
  return { success: true, result: value };
}

export function jsonToolResult(
  value: unknown,
  options?: { mode?: "summary" | "default" | "full" },
) {
  const mode = resolveMcpMode(options?.mode);
  const payload = mode === "full" ? value : compactMcpPayload(value);
  const serializedPayload = toStructuredContent(serializeDatesDeep(payload));
  const text = JSON.stringify(serializedPayload, null, 2);
  const structuredContent = JSON.parse(text) as Record<string, unknown>;
  return {
    structuredContent,
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
  };
}
