export type FormatMessage = (
  template: string,
  values: Record<string, number | string>,
) => string;

export type DashboardNamed = {
  nameCn?: string | null;
  nameEn?: string | null;
  namePrimary?: string | null;
  nameSecondary?: string | null;
};

export type NameFormatter = (item?: DashboardNamed | null) => string;
