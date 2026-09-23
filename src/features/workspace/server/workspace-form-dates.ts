import { parseShanghaiDateTimeLocalInput } from "@/lib/time/shanghai-format";

export function parseOptionalLocalDateTime(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return { ok: true as const, value: null };
  const parsed = parseShanghaiDateTimeLocalInput(raw);
  return parsed ? { ok: true as const, value: parsed } : { ok: false as const };
}
