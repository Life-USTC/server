export type BusRouteListing = {
  id: number;
  nameCn: string;
  nameEn: string | null;
  descriptionPrimary: string;
  stops: { stopOrder: number; campusId: number; campusName: string }[];
};

export type BusTripSlot = {
  position: number;
  stopTimes: { stopOrder: number; time: string | null }[];
};

export type BusRouteTimetable = {
  route: BusRouteListing;
  weekday: BusTripSlot[];
  weekend: BusTripSlot[];
  alternateRoutes: BusRouteListing[];
};
