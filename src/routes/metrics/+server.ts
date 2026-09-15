import { servePrometheusMetrics } from "@/features/admin/server/prometheus-metrics";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ request }) =>
  servePrometheusMetrics(request);
