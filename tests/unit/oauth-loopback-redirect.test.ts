import { describe, expect, it } from "vitest";
import { resolveEquivalentLoopbackRedirectUri } from "@/lib/oauth/loopback-redirect";

describe("oauth loopback redirect normalization", () => {
  it("returns the registered URI when localhost and 127.0.0.1 differ only by host", () => {
    expect(
      resolveEquivalentLoopbackRedirectUri(
        ["http://127.0.0.1:52877/callback"],
        "http://localhost:52877/callback",
      ),
    ).toBe("http://127.0.0.1:52877/callback");
  });

  it("keeps strict matching for path, port, query, and fragment", () => {
    expect(
      resolveEquivalentLoopbackRedirectUri(
        ["http://127.0.0.1:52877/callback"],
        "http://localhost:52878/callback",
      ),
    ).toBeNull();
    expect(
      resolveEquivalentLoopbackRedirectUri(
        ["http://127.0.0.1:52877/callback"],
        "http://localhost:52877/other",
      ),
    ).toBeNull();
    expect(
      resolveEquivalentLoopbackRedirectUri(
        ["http://127.0.0.1:52877/callback?code=1#done"],
        "http://localhost:52877/callback?code=2#done",
      ),
    ).toBeNull();
    expect(
      resolveEquivalentLoopbackRedirectUri(
        ["http://127.0.0.1:52877/callback?code=1#done"],
        "http://localhost:52877/callback?code=1#other",
      ),
    ).toBeNull();
  });

  it("does not rewrite non-loopback URIs", () => {
    expect(
      resolveEquivalentLoopbackRedirectUri(
        ["https://client.example/callback"],
        "https://client.example/callback",
      ),
    ).toBeNull();
  });
});
