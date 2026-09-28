import { expect, it } from "vitest";
import { isRegisteredOAuthRedirectUri } from "@/lib/oauth/redirect-uri";

it("permits native IP loopback port variance without changing callback identity", () => {
  const redirectUris = ["http://127.0.0.1:61000/callback?instance=desktop"];
  const native = { applicationType: "native", redirectUris };
  expect(
    isRegisteredOAuthRedirectUri(
      native,
      "http://127.0.0.1:62000/callback?instance=desktop",
    ),
  ).toBe(true);
  for (const uri of [
    "http://localhost:61000/callback?instance=desktop",
    "https://127.0.0.1:61000/callback?instance=desktop",
    "http://127.0.0.1:61000/other?instance=desktop",
    "http://127.0.0.1:61000/callback?instance=other",
    "http://127.0.0.1:61000/callback?instance=desktop#fragment",
    "http://user@127.0.0.1:61000/callback?instance=desktop",
    "invalid",
  ])
    expect(isRegisteredOAuthRedirectUri(native, uri), uri).toBe(false);
  for (const applicationType of [null, "web"])
    expect(
      isRegisteredOAuthRedirectUri(
        { applicationType, redirectUris },
        "http://127.0.0.1:62000/callback?instance=desktop",
      ),
    ).toBe(false);
  expect(
    isRegisteredOAuthRedirectUri(
      {
        applicationType: "native",
        redirectUris: ["http://localhost:61000/callback"],
      },
      "http://localhost:62000/callback",
    ),
  ).toBe(false);
});
