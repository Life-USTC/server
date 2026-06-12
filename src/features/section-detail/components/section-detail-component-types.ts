export type FormatMessage = (
  template: string,
  values: Record<string, number | string>,
) => string;

export type BooleanSetter = (value: boolean) => void;

export type IsSameMonth = (day: Date, monthStart: Date) => boolean;
