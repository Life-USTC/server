export type MatchedSubscriptionSection = {
  id: number;
  code: string;
  course: {
    nameCn?: string | null;
    nameEn?: string | null;
    namePrimary?: string | null;
  };
  semester?: {
    nameCn?: string | null;
    nameEn?: string | null;
    namePrimary?: string | null;
  } | null;
  campus?: {
    nameCn?: string | null;
    nameEn?: string | null;
    namePrimary?: string | null;
  } | null;
  teachers: Array<{
    nameCn?: string | null;
    nameEn?: string | null;
    namePrimary?: string | null;
  }>;
};

export type BulkImportCopy = {
  checkFormat: string;
  fetchFailed: string;
  importFailed: string;
  noMatches: string;
  noValidCodes: string;
};

export type MatchSectionsResult = {
  message: string;
  sections: MatchedSubscriptionSection[];
  unmatchedCodes: string[];
};
