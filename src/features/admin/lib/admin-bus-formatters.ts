export function formatBusVersionDate(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 10);
}

export function formatBusVersionEffectiveRange(version: {
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
}) {
  if (!version.effectiveFrom && !version.effectiveUntil) return "—";
  return `${formatBusVersionDate(version.effectiveFrom)} - ${formatBusVersionDate(version.effectiveUntil)}`;
}
