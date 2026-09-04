import { beforeEach, describe, expect, test, vi } from "vitest";
import { createDeferred } from "../../../shared/deferred";

const { imageResponses } = vi.hoisted(() => ({
  imageResponses: [] as Array<{
    html: string;
    options: { fonts: unknown[]; headers: Record<string, string> };
  }>,
}));

vi.mock("@ethercorps/sveltekit-og", () => ({
  ImageResponse: class extends Response {
    constructor(
      html: string,
      options: { fonts: unknown[]; headers: Record<string, string> },
    ) {
      imageResponses.push({ html, options });
      super(new Uint8Array([137, 80, 78, 71]), { headers: options.headers });
    }
  },
}));

vi.mock("$lib/assets/social-card-background.png?inline", () => ({
  default: "data:image/png;base64,iVBORw0KGgo=",
}));

import { renderSocialCard } from "@/lib/server/social-card-renderer";

const fontCss = `
  @font-face {
    font-family: 'Noto Sans SC';
    font-style: normal;
    font-weight: 400;
    src: url(https://fonts.gstatic.com/regular.ttf) format('truetype');
  }
  @font-face {
    font-family: 'Noto Sans SC';
    font-style: normal;
    font-weight: 700;
    src: url(https://fonts.gstatic.com/bold.ttf) format('truetype');
  }
`;

function responseWithUrl(
  body: BodyInit | null,
  url: string,
  init?: ResponseInit,
) {
  const response = new Response(body, init);
  Object.defineProperty(response, "url", { value: url });
  return response;
}

describe("social card renderer", () => {
  beforeEach(() => {
    imageResponses.length = 0;
  });

  test("starts avatar and consolidated font loading concurrently", async () => {
    const avatar = createDeferred<Response>();
    const fetcher = vi.fn<typeof fetch>((input) => {
      const url = String(input);
      if (url.startsWith("https://avatars.githubusercontent.com/")) {
        return avatar.promise;
      }
      if (url.startsWith("https://fonts.googleapis.com/")) {
        return Promise.resolve(new Response(fontCss, { status: 200 }));
      }
      if (url === "https://fonts.gstatic.com/regular.ttf") {
        return Promise.resolve(new Response(new Uint8Array([1, 2, 3])));
      }
      if (url === "https://fonts.gstatic.com/bold.ttf") {
        return Promise.resolve(new Response(new Uint8Array([4, 5, 6])));
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const rendering = renderSocialCard(
      {
        avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
        subtitle: "中英 mixed text",
        title: "科大喵",
        username: "life_ustc",
        variant: "profile",
      },
      fetcher,
    );

    await vi.waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/fonts\.googleapis\.com\/css2\?/u),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
    expect(imageResponses).toHaveLength(0);

    avatar.resolve(
      responseWithUrl(
        new Uint8Array([7, 8, 9]),
        "https://avatars.githubusercontent.com/u/1?v=4",
        { headers: { "content-type": "image/png" } },
      ),
    );

    const response = await rendering;
    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(
      fetcher.mock.calls.filter(([input]) =>
        String(input).startsWith("https://fonts."),
      ),
    ).toHaveLength(3);
    expect(imageResponses[0]?.options.fonts).toEqual([
      expect.objectContaining({ name: "Life Sans", weight: 400 }),
      expect.objectContaining({ name: "Life Sans", weight: 700 }),
    ]);
    expect(imageResponses[0]?.html).toContain("科大喵");
    expect(imageResponses[0]?.html).not.toContain("Life Mono");
  });

  test("falls back to initials when the avatar upstream fails", async () => {
    const fetcher = vi.fn<typeof fetch>((input) => {
      const url = String(input);
      if (url.startsWith("https://avatars.githubusercontent.com/")) {
        return Promise.resolve(new Response(null, { status: 503 }));
      }
      if (url.startsWith("https://fonts.googleapis.com/")) {
        return Promise.resolve(new Response(fontCss, { status: 200 }));
      }
      return Promise.resolve(new Response(new Uint8Array([1, 2, 3])));
    });

    await renderSocialCard(
      {
        avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
        title: "科大喵",
        variant: "profile",
      },
      fetcher,
    );

    expect(imageResponses[0]?.html).toContain(">科</div>");
    expect(imageResponses[0]?.html).not.toContain(
      '<img src="data:image/png;base64,iVBORw0KGgo=" width="154"',
    );
  });

  test("returns a short-lived deterministic PNG when fonts are unavailable", async () => {
    const response = await renderSocialCard(
      { title: "数据结构", variant: "course" },
      vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(null, { status: 503 })),
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("max-age=60");
    expect(response.headers.get("cloudflare-cdn-cache-control")).toContain(
      "max-age=300",
    );
    expect(new Uint8Array(await response.arrayBuffer()).slice(0, 8)).toEqual(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(imageResponses).toHaveLength(0);
  });

  test("bounds a stalled font upstream before returning the fallback", async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn<typeof fetch>(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("Timed out", "AbortError")),
            );
          }),
      );

      const rendering = renderSocialCard(
        { title: "网络超时", variant: "course" },
        fetcher,
      );
      await vi.advanceTimersByTimeAsync(1_999);
      expect(imageResponses).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);

      const response = await rendering;
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("max-age=60");
    } finally {
      vi.useRealTimers();
    }
  });

  test("sets separate browser and edge cache policies on rendered cards", async () => {
    const fetcher = vi.fn<typeof fetch>((input) => {
      const url = String(input);
      if (url.startsWith("https://fonts.googleapis.com/")) {
        return Promise.resolve(new Response(fontCss, { status: 200 }));
      }
      return Promise.resolve(new Response(new Uint8Array([1, 2, 3])));
    });

    const response = await renderSocialCard(
      { title: "Algorithms 算法", variant: "course" },
      fetcher,
    );

    expect(response.headers.get("cache-control")).toContain("max-age=3600");
    expect(response.headers.get("cloudflare-cdn-cache-control")).toContain(
      "max-age=86400",
    );
  });
});
