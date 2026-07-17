import { GraphQLError, GraphQLScalarType, Kind } from "graphql";

function outputOnlyDateError(): never {
  throw new GraphQLError("Date is output-only.");
}

export const graphqlDateScalar = new GraphQLScalarType({
  name: "Date",
  description: "A calendar date serialized as YYYY-MM-DD.",
  serialize(value) {
    const date =
      value instanceof Date
        ? value
        : typeof value === "string" || typeof value === "number"
          ? new Date(value)
          : null;
    if (!date || Number.isNaN(date.getTime())) {
      throw new GraphQLError("Date cannot represent this value.");
    }
    return date.toISOString().slice(0, 10);
  },
  parseValue: outputOnlyDateError,
  parseLiteral: outputOnlyDateError,
});

function invalidDateTime(): never {
  throw new GraphQLError(
    "DateTime must be an ISO 8601 datetime with a timezone.",
    {
      extensions: { code: "BAD_USER_INPUT" },
    },
  );
}

function parseZonedDateTime(value: unknown) {
  if (typeof value !== "string") invalidDateTime();
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (!match) invalidDateTime();

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = Number((match[7] ?? "").padEnd(3, "0"));
  const offsetHour = Number(match[10] ?? 0);
  const offsetMinute = Number(match[11] ?? 0);

  const calendarValue = new Date(0);
  calendarValue.setUTCFullYear(year, month - 1, day);
  calendarValue.setUTCHours(hour, minute, second, millisecond);
  if (
    year < 1 ||
    calendarValue.getUTCFullYear() !== year ||
    calendarValue.getUTCMonth() !== month - 1 ||
    calendarValue.getUTCDate() !== day ||
    calendarValue.getUTCHours() !== hour ||
    calendarValue.getUTCMinutes() !== minute ||
    calendarValue.getUTCSeconds() !== second ||
    offsetHour > 14 ||
    offsetMinute > 59 ||
    (offsetHour === 14 && offsetMinute !== 0) ||
    Number.isNaN(Date.parse(value))
  ) {
    invalidDateTime();
  }
  return value;
}

export const graphqlDateTimeScalar = new GraphQLScalarType({
  name: "DateTime",
  description: "An ISO 8601 datetime with an explicit timezone.",
  serialize(value) {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) invalidDateTime();
      return value.toISOString();
    }
    return parseZonedDateTime(value);
  },
  parseValue: parseZonedDateTime,
  parseLiteral(node) {
    if (node.kind !== Kind.STRING) invalidDateTime();
    return parseZonedDateTime(node.value);
  },
});
