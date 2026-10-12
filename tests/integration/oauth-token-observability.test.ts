import { expect } from "vitest";
import { tokenPostRoute } from "@/lib/api/routes/auth-token";
import { getOAuthMcpResourceUrl } from "@/lib/oauth/resource-urls";
import {
  oauthObservationTest,
  tokenRequest,
} from "../shared/oauth-observation-fixture";

oauthObservationTest(
  "oauth.token-endpoint-observability",
  { tags: ["@OAuth/OAuth"] },
  async ({ observation, observationRuntime }) => {
    await observationRuntime.run(async () => {
      const { clientId } = observation;
      const { writeDataPoint } = observationRuntime;
      const response = await observationRuntime.request(() =>
        tokenPostRoute(tokenRequest(clientId)),
      );
      expect([400, 401], await response.clone().text()).toContain(
        response.status,
      );
      await response.text();
      const events = writeDataPoint.mock.calls
        .map(([point]) => point)
        .filter((point) => point.blobs[0] === "oauth_event_v3");
      const stages = events.filter(
        (point) => point.blobs[1] === "token.stage.success",
      );
      expect(stages.map((point) => point.blobs[8])).toEqual([
        "validate-active-grant",
        "validate-refresh-resources",
        "prepare-provider-request",
        "secure-provider-response",
        "cleanup-rejected-grant",
        "persist-refresh-resources",
        "bind-access-token-consent",
      ]);
      const provider = events.find(
        (point) =>
          point.blobs[1] === "oauth.token.error_response" &&
          point.blobs[5] === "none",
      );
      const whole = events.find(
        (point) =>
          point.blobs[1].startsWith("oauth.token.") &&
          point.blobs[5] === "authorization_code" &&
          point.blobs[8] === "none",
      );
      expect(provider).toBeDefined();
      expect(whole).toBeDefined();
      for (const point of events)
        expect(point.doubles[0]).toBeGreaterThanOrEqual(0);
      expect(whole.doubles[0]).toBeGreaterThanOrEqual(provider.doubles[0]);
      const serialized = JSON.stringify(events);
      expect(serialized).not.toMatch(/private-|upstream|stack|message/);
      expect(serialized).not.toContain(clientId);
      expect(serialized).not.toContain(getOAuthMcpResourceUrl());
    });
  },
);
