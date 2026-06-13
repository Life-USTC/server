export type CalendarTone =
  | "primary"
  | "warning"
  | "success"
  | "info"
  | "error"
  | "neutral";

export type CalendarGridEvent = {
  done?: boolean;
  href?: string;
  label: string;
  title?: string;
  tooltip?: string;
  meta?: string;
  detail?: string;
  tone?: CalendarTone;
};

export type CalendarGridDay = {
  key: string;
  label: string;
  sublabel?: string;
  isToday?: boolean;
  isMuted?: boolean;
  events: CalendarGridEvent[];
};

export type CalendarGridWeek = {
  label?: string;
  days: CalendarGridDay[];
};
