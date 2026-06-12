type PrimaryName = {
  nameCn?: string | null;
  namePrimary?: string | null;
};

type SecondaryName = {
  nameEn?: string | null;
  nameSecondary?: string | null;
};

type TeacherName = PrimaryName & SecondaryName;

export function primaryName(item?: PrimaryName | null) {
  return item?.namePrimary ?? item?.nameCn ?? "";
}

export function secondaryName(item?: SecondaryName | null) {
  return item?.nameSecondary ?? item?.nameEn ?? "";
}

export function formatMessage(
  template: string,
  values: Record<string, string>,
) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replace(`{${key}}`, value),
    template,
  );
}

export function teacherName(teacher: TeacherName) {
  const primary = primaryName(teacher);
  const secondary = secondaryName(teacher);
  return secondary ? `${primary} (${secondary})` : primary;
}

export function sectionTeachersLabel(
  section: { teachers: TeacherName[] },
  noTeacherLabel: string,
) {
  if (section.teachers.length === 0) return noTeacherLabel;
  return section.teachers.map(teacherName).join(", ");
}

export function yesNoLabel(
  value: boolean | null | undefined,
  labels: { fallback: string; no: string; yes: string },
) {
  if (value === true) return labels.yes;
  if (value === false) return labels.no;
  return labels.fallback;
}

export function homeworkAuditActionLabel(
  action: string,
  labels: { created: string; deleted: string },
) {
  if (action === "deleted") return labels.deleted;
  return labels.created;
}
