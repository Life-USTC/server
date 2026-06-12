import type { jsonToolResult } from "./helper-results";

export type OptionalFieldDateParseResult =
  | {
      ok: true;
      value: Date | null | undefined;
    }
  | {
      ok: false;
      result: ReturnType<typeof jsonToolResult>;
    };

export type OptionalMcpDateParseOptions = {
  dateOnlyAsShanghaiStart?: boolean;
};

export type McpDateParseFailure = {
  ok: false;
  result: ReturnType<typeof jsonToolResult>;
};

export type OptionalMcpDate =
  | {
      ok: true;
      value?: Date;
      dateOnly: boolean;
    }
  | McpDateParseFailure;

export type McpDateRange =
  | {
      ok: true;
      dateFrom?: Date;
      dateTo?: Date;
      dateFromIsDateOnly: boolean;
      dateToIsDateOnly: boolean;
    }
  | McpDateParseFailure;

export type McpDateRangeInput = {
  dateFrom?: string;
  dateTo?: string;
};
