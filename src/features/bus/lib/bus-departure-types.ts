import type {
  BusCampusSummary,
  BusTripStatus,
} from "@/features/bus/lib/bus-timetable-types";
import type { BusScheduleDayType } from "@/generated/prisma/client";

export type BusNextDeparture = {
  tripId: number;
  routeId: number;
  route: {
    id: number;
    nameCn: string;
    nameEn: string | null;
    descriptionPrimary: string;
    descriptionSecondary: string | null;
  };
  originCampus: BusCampusSummary | null;
  destinationCampus: BusCampusSummary | null;
  departureTime: string | null;
  arrivalTime: string | null;
  departureEstimated: boolean;
  arrivalEstimated: boolean;
  minutesUntilDeparture: number | null;
  dayType: BusScheduleDayType;
  status: BusTripStatus;
};

export type BusNextDeparturesResult = {
  originCampus: BusCampusSummary | null;
  destinationCampus: BusCampusSummary | null;
  atTime: string;
  dayType: "weekday" | "weekend";
  totalRoutes: number;
  departures: BusNextDeparture[];
  nextAvailableDeparture: BusNextDeparture | null;
  message: string | null;
};
