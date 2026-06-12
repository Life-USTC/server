export type BusMapCampusNode = {
  id: number;
  namePrimary: string;
  nameSecondary: string | null;
  latitude: number;
  longitude: number;
};

export type BusMapRouteEdge = {
  routeId: number;
  descriptionPrimary: string;
  stops: { campusId: number; campusName: string }[];
  weekdayTrips: number;
  weekendTrips: number;
};

export type BusMapActiveTrip = {
  tripId: number;
  routeId: number;
  status: "en-route" | "departing-soon";
  departureTime: string | null;
  arrivalTime: string | null;
  fromStopOrder: number | null;
  toStopOrder: number | null;
  segmentProgress: number | null;
};

export type BusMapData = {
  campuses: BusMapCampusNode[];
  routes: BusMapRouteEdge[];
  activeTrips: BusMapActiveTrip[];
  todayType: "weekday" | "weekend";
  now: string;
};

export type BusMapPoint = {
  x: number;
  y: number;
};

export type BusMapRoutePath = {
  path: string;
  points: BusMapPoint[];
};

export type BusMapDayTypeLabels = Record<BusMapData["todayType"], string>;

export type BusMapCopy = {
  backToBus: string;
  experimental: string;
  legend: {
    departingSoon: string;
    enRoute: string;
    route: string;
    title: string;
  };
  legendTrips: string;
  mapTitle: string;
  networkDescription: string;
  networkOverview: string;
  noData: string;
  noDataDescription: string;
  refresh: string;
  routes: string;
  serviceDay: string;
  status: {
    departingSoon: string;
    enRoute: string;
    noActive: string;
  };
  statusTitle: string;
  subtitle: string;
  title: string;
  tripCount: Record<BusMapData["todayType"], string>;
  tripsToday: string;
  updated: string;
};
