import openApiSpec from "../../../../public/openapi.generated.json";

const OPENAPI_BODY = JSON.stringify(openApiSpec);

export function getOpenApiRoute() {
  return new Response(OPENAPI_BODY, {
    headers: {
      "cache-control": "public, max-age=300",
      "content-type": "application/json; charset=utf-8",
    },
  });
}
