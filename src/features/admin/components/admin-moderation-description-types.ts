export type AdminModerationDescription = {
  content?: string | null;
  id: string | number;
  lastEditedAt?: string | Date | null;
  lastEditedBy?: {
    id?: string | null;
    name?: string | null;
    username?: string | null;
  } | null;
  updatedAt: string | Date;
};

export type AdminModerationDescriptionCopy = {
  actions: string;
  author: string;
  descriptionContentWith: string;
  descriptionPreview: string;
  descriptionTarget: string;
  descriptionTargetAll: string;
  editedAtLabel: string;
  emptyDescription: string;
  lastEditor: string;
  manageDescription: string;
  noDescriptions: string;
  notAvailable: string;
  postedIn: string;
  showingResults: string;
};

export type AdminModerationDescriptionOption = {
  label: string;
  value: string;
};
