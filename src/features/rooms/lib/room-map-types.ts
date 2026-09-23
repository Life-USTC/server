export type RoomMapStatus = "highlighted" | "overview" | "unavailable";

export type RoomMapResult = {
  building: string | null;
  code: string;
  floor: string | null;
  imageUrl: string | null;
  sourceImageUrl: string | null;
  status: RoomMapStatus;
};

export type RoomMapCopy = {
  building: string;
  close: string;
  dialogDescription: string;
  dialogTitle: string;
  empty: string;
  fetchError: string;
  floor: string;
  highlighted: string;
  loading: string;
  mapAlt: string;
  openMap: string;
  overview: string;
  placeholder: string;
  resetZoom: string;
  searchLabel: string;
  sourceImage: string;
  subtitle: string;
  submit: string;
  title: string;
  triggerLabel: string;
  unavailable: string;
  unavailableDescription: string;
  zoomIn: string;
  zoomOut: string;
};

export function formatRoomMapCopy(template: string, code: string) {
  return template.replaceAll("{code}", code);
}

export function splitRoomLabels(value: string | null | undefined) {
  return (value ?? "")
    .split(/[,，、;；]/u)
    .map((room) => room.trim())
    .filter(
      (room, index, rooms) => room.length > 0 && rooms.indexOf(room) === index,
    );
}

export function isRoomMapResult(value: unknown): value is RoomMapResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Partial<RoomMapResult>;
  return (
    typeof result.code === "string" &&
    (result.building === null || typeof result.building === "string") &&
    (result.floor === null || typeof result.floor === "string") &&
    (result.imageUrl === null || typeof result.imageUrl === "string") &&
    (result.sourceImageUrl === null ||
      typeof result.sourceImageUrl === "string") &&
    (result.status === "highlighted" ||
      result.status === "overview" ||
      result.status === "unavailable")
  );
}
