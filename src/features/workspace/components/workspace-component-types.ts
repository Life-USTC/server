export type FormatMessage = (
  template: string,
  values: Record<string, number | string>,
) => string;

export type WorkspaceNamed = {
  nameCn?: string | null;
  nameEn?: string | null;
  namePrimary?: string | null;
  nameSecondary?: string | null;
};

export type NameFormatter = (item?: WorkspaceNamed | null) => string;
