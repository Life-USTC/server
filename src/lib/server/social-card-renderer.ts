import { ImageResponse } from "@ethercorps/sveltekit-og";
import { GoogleFont, resolveFonts } from "@ethercorps/sveltekit-og/fonts";
import {
  normalizeSocialCardOptions,
  SOCIAL_CARD_HEIGHT,
  SOCIAL_CARD_WIDTH,
  type SocialCardOptions,
} from "@/lib/social-card";
import socialCardBackground from "$lib/assets/social-card-background.png?inline";

const MAX_AVATAR_BYTES = 1_000_000;
const allowedAvatarContentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);
const MONO_FONT_FAMILY = "Life Mono";
const SANS_FONT_FAMILY = "Life Sans";

function isAllowedAvatarUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;

    return (
      url.hostname === "api.dicebear.com" ||
      url.hostname === "avatars.githubusercontent.com" ||
      url.hostname === "lh3.googleusercontent.com" ||
      url.hostname.endsWith(".googleusercontent.com")
    );
  } catch {
    return false;
  }
}

function bufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return btoa(binary);
}

async function loadAvatarDataUrl(
  avatarUrl: string | undefined,
  fetcher: typeof fetch,
) {
  if (!avatarUrl || !isAllowedAvatarUrl(avatarUrl)) return undefined;

  try {
    const response = await fetcher(avatarUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/svg+xml",
      },
    });
    if (!response.ok || !isAllowedAvatarUrl(response.url)) return undefined;

    const contentType = response.headers.get("content-type")?.split(";")[0];
    if (!contentType || !allowedAvatarContentTypes.has(contentType)) {
      return undefined;
    }

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_AVATAR_BYTES) {
      return undefined;
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_AVATAR_BYTES) return undefined;

    return `data:${contentType};base64,${bufferToBase64(buffer)}`;
  } catch {
    return undefined;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function uniqueCharacters(value: string) {
  return Array.from(new Set(Array.from(value))).join("");
}

function usesMonoFont(character: string) {
  const codePoint = character.codePointAt(0) ?? 0;
  return (
    (codePoint >= 0x20 && codePoint <= 0x7f) ||
    /\p{Number}|\p{Script=Latin}/u.test(character)
  );
}

function fontCharacters(value: string, mono: boolean) {
  return uniqueCharacters(
    Array.from(value)
      .filter((character) => usesMonoFont(character) === mono)
      .join(""),
  );
}

function mixedTextHtml(value: string) {
  const runs: Array<{ mono: boolean; space?: boolean; text: string }> = [];

  for (const character of Array.from(value)) {
    if (character === " ") {
      runs.push({ mono: true, space: true, text: "" });
      continue;
    }
    const mono = usesMonoFont(character);
    const previous = runs.at(-1);
    if (!previous?.space && previous?.mono === mono) {
      previous.text += character;
    } else {
      runs.push({ mono, text: character });
    }
  }

  return runs
    .map(({ mono, space, text }) =>
      space
        ? '<span style="display:flex; width:0.55em;"></span>'
        : `<span style="display:flex; font-family:'${
            mono ? MONO_FONT_FAMILY : SANS_FONT_FAMILY
          }';">${escapeHtml(text)}</span>`,
    )
    .join("");
}

function textUnits(value: string) {
  return Array.from(value).reduce(
    (total, character) => total + (usesMonoFont(character) ? 0.62 : 1),
    0,
  );
}

function fitInlineFontSize(
  value: string,
  preferredSize: number,
  minSize: number,
  maxWidth: number,
) {
  return Math.max(
    minSize,
    Math.min(preferredSize, maxWidth / Math.max(textUnits(value), 1)),
  );
}

function titleFontSize(title: string, profile: boolean) {
  const units = textUnits(title);
  if (profile) return units <= 12 ? 58 : units <= 20 ? 50 : 43;
  if (units <= 12) return 62;
  if (units <= 20) return 54;
  if (units <= 30) return 47;
  return 41;
}

function wrapText(
  value: string,
  fontSize: number,
  maxWidth: number,
  maxLines: number,
) {
  const maxUnits = maxWidth / fontSize;
  const lines: string[] = [];
  let line = "";
  let units = 0;

  for (const character of Array.from(value)) {
    const characterUnits = usesMonoFont(character) ? 0.62 : 1;
    if (line && units + characterUnits > maxUnits) {
      if (lines.length === maxLines - 1) {
        while (line && units + 1 > maxUnits) {
          const removed = Array.from(line).pop() ?? "";
          line = Array.from(line).slice(0, -1).join("");
          units -= usesMonoFont(removed) ? 0.62 : 1;
        }
        lines.push(`${line}…`);
        return lines;
      }
      lines.push(line);
      line = character;
      units = characterUnits;
      continue;
    }
    line += character;
    units += characterUnits;
  }
  if (line) lines.push(line);

  return lines;
}

function titleHtml(title: string, profile: boolean) {
  const fontSize = titleFontSize(title, profile);
  const lines = wrapText(title, fontSize, profile ? 476 : 700, 3);

  return {
    fontSize,
    height: lines.length * fontSize * 1.14,
    html: lines
      .map(
        (line) =>
          `<div style="display:flex; height:${fontSize * 1.14}px; align-items:baseline;">${mixedTextHtml(line)}</div>`,
      )
      .join(""),
  };
}

function textBlockHtml(
  value: string,
  fontSize: number,
  maxWidth: number,
  maxLines: number,
) {
  return wrapText(value, fontSize, maxWidth, maxLines)
    .map(
      (line) =>
        `<div style="display:flex; height:${fontSize * 1.42}px; align-items:baseline;">${mixedTextHtml(line)}</div>`,
    )
    .join("");
}

function buildStandardContent(
  options: ReturnType<typeof normalizeSocialCardOptions>,
) {
  const title = titleHtml(options.title, false);

  return `
    <div style="display:flex; position:absolute; left:72px; top:158px; width:700px; flex-direction:column;">
      <div style="display:flex; color:#27272A; font-size:${title.fontSize}px; font-weight:700; line-height:1.14; flex-direction:column;">
        ${title.html}
      </div>
      ${
        options.subtitle
          ? `<div style="display:flex; width:700px; margin-top:26px; color:#71717A; font-size:25px; font-weight:400; line-height:1.42; flex-direction:column;">${textBlockHtml(options.subtitle, 25, 700, 2)}</div>`
          : ""
      }
    </div>
  `;
}

function buildProfileContent(
  options: ReturnType<typeof normalizeSocialCardOptions>,
  avatarDataUrl: string | undefined,
) {
  const fallback = escapeHtml(Array.from(options.title.trim())[0] ?? "U");
  const title = titleHtml(options.title, true);
  const username = options.username
    ? `@${options.username.replace(/^@/u, "")}`
    : "";
  const usernameFontSize = fitInlineFontSize(username, 23, 17, 476);
  const avatar = avatarDataUrl
    ? `<img src="${avatarDataUrl}" width="154" height="154" style="width:154px; height:154px; object-fit:cover;" />`
    : `<div style="display:flex; width:154px; height:154px; align-items:center; justify-content:center; background:#F4F4F5; color:#00C3D0; font-size:64px; font-weight:700; font-family:'${SANS_FONT_FAMILY}';">${fallback}</div>`;

  return `
    <div style="display:flex; position:absolute; left:72px; top:176px; width:700px; align-items:center;">
      <div style="display:flex; width:160px; height:160px; flex:none; align-items:center; justify-content:center; overflow:hidden; border:3px solid #D4D4D8; border-radius:9999px; background:#F4F4F5;">
        ${avatar}
      </div>
      <div style="display:flex; width:476px; min-width:0; margin-left:32px; flex-direction:column;">
        <div style="display:flex; color:#27272A; font-size:${title.fontSize}px; font-weight:700; line-height:1.14; flex-direction:column;">
          ${title.html}
        </div>
        ${
          username
            ? `<div style="display:flex; margin-top:10px; color:#27272A; font-size:${usernameFontSize}px; font-weight:700; align-items:baseline;">${mixedTextHtml(username)}</div>`
            : ""
        }
        ${
          options.subtitle
            ? `<div style="display:flex; width:476px; margin-top:18px; color:#71717A; font-size:21px; font-weight:400; line-height:1.42; flex-direction:column;">${textBlockHtml(options.subtitle, 21, 476, 2)}</div>`
            : ""
        }
      </div>
    </div>
  `;
}

function buildSocialCardHtml(
  options: ReturnType<typeof normalizeSocialCardOptions>,
  avatarDataUrl: string | undefined,
) {
  const labelFontSize = fitInlineFontSize(options.label, 16, 12, 520);
  const footerFontSize = fitInlineFontSize(options.footer, 16, 11, 700);
  const content =
    options.variant === "profile"
      ? buildProfileContent(options, avatarDataUrl)
      : buildStandardContent(options);

  return `
    <div style="display:flex; position:relative; width:${SOCIAL_CARD_WIDTH}px; height:${SOCIAL_CARD_HEIGHT}px; overflow:hidden; background:#FAFAFA; font-family:'${SANS_FONT_FAMILY}';">
      <img src="${socialCardBackground}" width="${SOCIAL_CARD_WIDTH}" height="${SOCIAL_CARD_HEIGHT}" style="position:absolute; inset:0; width:${SOCIAL_CARD_WIDTH}px; height:${SOCIAL_CARD_HEIGHT}px; opacity:0.36;" />
      <div style="display:flex; position:absolute; left:72px; top:50px; width:700px; height:54px; align-items:baseline; justify-content:space-between; border-bottom:2px solid #D4D4D8;">
        <div style="display:flex; color:#27272A; font-size:18px; font-weight:700; align-items:baseline;">${mixedTextHtml("Life @ USTC")}</div>
        <div style="display:flex; position:relative; top:-2px; color:#71717A; font-size:${labelFontSize}px; font-weight:400; align-items:baseline;">${mixedTextHtml(options.label)}</div>
      </div>
      <div style="display:flex; position:absolute; left:72px; top:102px; width:72px; height:4px; background:#00C3D0;"></div>
      ${content}
      <div style="display:flex; position:absolute; left:72px; bottom:54px; color:#71717A; font-size:${footerFontSize}px; font-weight:400; align-items:baseline;">${mixedTextHtml(options.footer)}</div>
    </div>
  `;
}

export async function renderSocialCard(
  input: SocialCardOptions,
  fetcher: typeof fetch = fetch,
) {
  const options = normalizeSocialCardOptions(input);
  const avatarDataUrl =
    options.variant === "profile"
      ? await loadAvatarDataUrl(options.avatarUrl, fetcher)
      : undefined;
  const regularText = `${options.subtitle}${options.footer}${options.label}…`;
  const boldText = `${options.title}@${options.username ?? ""}Life @ USTC…`;
  const fonts = await resolveFonts([
    new GoogleFont("Noto Sans SC", {
      name: SANS_FONT_FAMILY,
      text: fontCharacters(regularText, false) || "科大",
      weight: 400,
    }),
    new GoogleFont("Noto Sans SC", {
      name: SANS_FONT_FAMILY,
      text: fontCharacters(boldText, false) || "科大",
      weight: 700,
    }),
    new GoogleFont("Fira Code", {
      name: MONO_FONT_FAMILY,
      text: fontCharacters(regularText, true) || "Life @ USTC",
      weight: 400,
    }),
    new GoogleFont("Fira Code", {
      name: MONO_FONT_FAMILY,
      text: fontCharacters(boldText, true) || "Life @ USTC",
      weight: 700,
    }),
  ]);

  return new ImageResponse(buildSocialCardHtml(options, avatarDataUrl), {
    fonts,
    height: SOCIAL_CARD_HEIGHT,
    width: SOCIAL_CARD_WIDTH,
    headers: {
      "Cache-Control":
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "Content-Type": "image/png",
    },
  });
}
