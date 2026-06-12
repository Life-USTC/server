export type MatchedSectionCodes = {
  semester: {
    id: number;
    nameCn: string;
    code: string;
  };
  matchedCodes: string[];
  unmatchedCodes: string[];
  suggestions: Record<string, string[]>;
  sections: Array<{
    id: number;
    jwId: number;
    code: string;
    [key: string]: unknown;
  }>;
  total: number;
};
