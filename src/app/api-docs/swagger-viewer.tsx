"use client";

import { useEffect } from "react";
import SwaggerUIBundle from "swagger-ui-dist/swagger-ui-bundle";
import "swagger-ui-dist/swagger-ui.css";
import { OPENAPI_SPEC_PUBLIC_PATH } from "@/lib/openapi/spec";

const FALLBACK_PATHS = [
  "/api/sections",
  "/api/courses",
  "/api/teachers",
  "/api/semesters/current",
] as const;

export function SwaggerViewer() {
  useEffect(() => {
    const container = document.getElementById("swagger-ui");
    if (!container) return;

    container.replaceChildren();
    SwaggerUIBundle({
      url: OPENAPI_SPEC_PUBLIC_PATH,
      dom_id: "#swagger-ui",
      deepLinking: true,
    });
  }, []);

  return (
    <>
      <style jsx global>{`
        @media (max-width: 640px) {
          .swagger-ui .wrapper {
            padding-inline: 1rem !important;
          }

          .swagger-ui .scheme-container {
            padding: 1rem !important;
          }

          .swagger-ui .info {
            margin-block: 1.25rem !important;
          }

          .swagger-ui .info .title {
            font-size: 1.75rem !important;
            line-height: 2rem !important;
          }

          .swagger-ui .opblock-summary {
            align-items: flex-start !important;
            flex-wrap: wrap !important;
            gap: 0.35rem !important;
            padding: 0.75rem !important;
          }

          .swagger-ui .opblock-summary-method {
            flex-shrink: 0 !important;
          }

          .swagger-ui .opblock-summary-path,
          .swagger-ui .opblock-summary-path__deprecated {
            min-width: 0 !important;
            overflow-wrap: anywhere !important;
            white-space: normal !important;
          }

          .swagger-ui .opblock-summary-description {
            flex-basis: 100% !important;
            padding-left: 0 !important;
          }

          .swagger-ui table {
            display: block !important;
            overflow-x: auto !important;
            width: 100% !important;
          }

          .swagger-ui .parameters-col_description,
          .swagger-ui .response-col_description {
            min-width: 14rem !important;
          }
        }
      `}</style>
      <main
        id="swagger-ui"
        className="page-main min-h-screen overflow-x-hidden"
      >
        <section className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-muted-foreground text-sm">
            Loading OpenAPI docs...
          </p>
          <ul className="mt-4 grid gap-2 font-mono text-sm">
            {FALLBACK_PATHS.map((path) => (
              <li key={path}>{path}</li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
