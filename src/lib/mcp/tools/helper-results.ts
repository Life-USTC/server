import { compactMcpPayload } from "@/lib/mcp/compact-payload";
import { serializeDatesDeep } from "@/lib/time/serialize-date-output";
import { isRecord } from "@/lib/utils";
import { resolveMcpMode } from "./helper-schemas";

function summarizeArray(items: unknown[], limit: number) {
  const returned = items.length;
  return {
    total: returned,
    returned,
    remaining: Math.max(returned - limit, 0),
    truncated: returned > limit,
    items: items.slice(0, limit).map(compactMcpPayload),
  };
}

function getPaginatedTotal(
  key: string,
  source: Record<string, unknown>,
): number | undefined {
  if (key !== "data") {
    return undefined;
  }

  const pagination = source.pagination;
  if (!isRecord(pagination) || typeof pagination.total !== "number") {
    return undefined;
  }

  return pagination.total;
}

function summarizeMcpPayload(value: unknown): unknown {
  if (Array.isArray(value)) return summarizeArray(value, 10);
  if (!isRecord(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (Array.isArray(v)) {
      const sampleLimit = key === "events" ? 25 : 10;
      const total = getPaginatedTotal(key, value);
      out[key] = {
        ...summarizeArray(v, sampleLimit),
        ...(total !== undefined ? { total } : {}),
      };
    } else {
      out[key] = compactMcpPayload(v);
    }
  }

  return out;
}

export function jsonToolResult(
  value: unknown,
  options?: { mode?: "summary" | "default" | "full" },
) {
  const mode = resolveMcpMode(options?.mode);
  const payload =
    mode === "full"
      ? value
      : mode === "summary"
        ? summarizeMcpPayload(value)
        : compactMcpPayload(value);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(serializeDatesDeep(payload), null, 2),
      },
    ],
  };
}
