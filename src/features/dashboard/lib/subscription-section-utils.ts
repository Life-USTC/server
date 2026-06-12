type SectionWithSemester = {
  semester?: {
    id?: number | string | null;
    nameCn?: string | null;
    startDate?: string | null;
  } | null;
};

export function extractSectionCodes(value: string) {
  return Array.from(new Set(value.match(/[A-Z0-9_.-]+\.[A-Z0-9]{2}/g) ?? []));
}

export function groupSubscribedSectionsBySemester<
  Section extends SectionWithSemester,
>(sections: Section[], fallbackLabel: string) {
  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      startDate: string | null;
      sections: Section[];
    }
  >();

  for (const section of sections) {
    const key = section.semester?.id?.toString() ?? "unknown";
    const existing = groups.get(key) ?? {
      key,
      label: section.semester?.nameCn ?? fallbackLabel,
      startDate: section.semester?.startDate ?? null,
      sections: [],
    };
    existing.sections.push(section);
    groups.set(key, existing);
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (left.startDate && right.startDate) {
      return right.startDate.localeCompare(left.startDate);
    }
    if (left.startDate) return -1;
    if (right.startDate) return 1;
    return right.label.localeCompare(left.label);
  });
}
