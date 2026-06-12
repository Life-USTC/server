export type BusImportResult = {
  versionId: number;
  versionKey: string;
  campuses: number;
  routes: number;
  trips: number;
};

export type BusStaticCampus = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
};

export type BusStaticRoute = {
  id: number;
  campuses: BusStaticCampus[];
};

export type BusStaticRouteSchedule = {
  id: number;
  route: BusStaticRoute;
  time: Array<Array<string | null>>;
};

export type BusStaticPayload = {
  campuses: BusStaticCampus[];
  routes: BusStaticRoute[];
  weekday_routes: BusStaticRouteSchedule[];
  weekend_routes: BusStaticRouteSchedule[];
  message?: {
    message?: string;
    url?: string;
  } | null;
};
