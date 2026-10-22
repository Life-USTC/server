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
  options?: { mode?: "default" | "full" },
) {
  const mode = resolveMcpMode(options?.mode);
  const payload = mode === "full" ? value : compactMcpPayload(value);
  const serializedPayload = toStructuredContent(serializeDatesDeep(payload));
  // Minified: indentation is a third of the text block and of the tokens every
  // MCP client spends on it, and the JSON carries the same data either way.
  const text = JSON.stringify(serializedPayload);
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
