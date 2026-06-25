type SemesterGroupSection = {
  semester: {
    id: number | null;
    nameCn: string | null;
    startDate: Date | null;
  } | null;
};

export type GroupedSections<TSection> = {
  key: string;
  label: string;
  startDate: Date | null;
  sections: TSection[];
};

export function groupSectionsBySemester<TSection extends SemesterGroupSection>(
  sections: TSection[],
): GroupedSections<TSection>[] {
  const groups = sections.reduce((acc, section) => {
    const key = section.semester?.id?.toString() ?? "unknown";
    const label = section.semester?.nameCn ?? "—";
    const startDate = section.semester?.startDate ?? null;
    const existing = acc.get(key) ?? {
      key,
      label,
      startDate,
      sections: [],
    };
    existing.sections.push(section);
    acc.set(key, existing);
    return acc;
  }, new Map<string, GroupedSections<TSection>>());

  return Array.from(groups.values()).sort((a, b) => {
    if (a.startDate && b.startDate) {
      return b.startDate.getTime() - a.startDate.getTime();
    }
    if (a.startDate) return -1;
    if (b.startDate) return 1;
    return b.label.localeCompare(a.label);
  });
}

export function countDistinctSemesterIds<
  TSection extends { semester: { id: number | null } | null },
>(subscriptions: Array<{ sections: TSection[] }>) {
  return new Set(
    subscriptions.flatMap((subscription) =>
      subscription.sections
        .map((section) => section.semester?.id)
        .filter((id): id is number => id !== null),
    ),
  ).size;
}
