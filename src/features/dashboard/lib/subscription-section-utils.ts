type SectionWithSemester = {
  semester?: {
    endDate?: string | null;
    id?: number | string | null;
    nameCn?: string | null;
    startDate?: string | null;
  } | null;
};

function timestamp(value: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function distanceFromDateRange(
  startDate: string | null,
  endDate: string | null,
  referenceTime: number,
) {
  const startTime = timestamp(startDate);
  const endTime = timestamp(endDate);

  if (startTime !== null && endTime !== null) {
    if (referenceTime < startTime) return startTime - referenceTime;
    if (referenceTime > endTime) return referenceTime - endTime;
    return 0;
  }
  if (startTime !== null) return Math.abs(referenceTime - startTime);
  if (endTime !== null) return Math.abs(referenceTime - endTime);
  return Number.POSITIVE_INFINITY;
}

export function groupSubscribedSectionsBySemester<
  Section extends SectionWithSemester,
>(
  sections: Section[],
  fallbackLabel: string,
  referenceDate: Date | string = new Date(),
) {
  const referenceTime =
    referenceDate instanceof Date
      ? referenceDate.getTime()
      : Date.parse(referenceDate);
  const groups = new Map<
    string,
    {
      endDate: string | null;
      key: string;
      label: string;
      startDate: string | null;
      sections: Section[];
    }
  >();

  for (const section of sections) {
    const key = section.semester?.id?.toString() ?? "unknown";
    const existing = groups.get(key) ?? {
      endDate: section.semester?.endDate ?? null,
      key,
      label: section.semester?.nameCn ?? fallbackLabel,
      startDate: section.semester?.startDate ?? null,
      sections: [],
    };
    existing.sections.push(section);
    groups.set(key, existing);
  }

  return Array.from(groups.values()).sort((left, right) => {
    const distance =
      distanceFromDateRange(left.startDate, left.endDate, referenceTime) -
      distanceFromDateRange(right.startDate, right.endDate, referenceTime);
    if (distance !== 0) return distance;

    if (left.startDate && right.startDate)
      return right.startDate.localeCompare(left.startDate);
    if (left.startDate) return -1;
    if (right.startDate) return 1;
    return right.label.localeCompare(left.label);
  });
}
