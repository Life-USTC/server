import { createHash } from "node:crypto";
import type {
  RoomMapBuilding,
  RoomMapCopy,
} from "@/features/rooms/lib/room-map-types";
import {
  type RoomMap,
  roomCodeSchema,
} from "@/features/rooms/server/room-map-schema";
import type { AppLocale } from "@/i18n/config";
import enUs from "../../../../messages/en-us.json";
import zhCn from "../../../../messages/zh-cn.json";

const assetBase = "/api/catalog/rooms/images/";
const floorAsset = "demo-floor.svg";
const highlightedAsset = "demo-room-101.svg";

/** The real directory lists rooms with highlighted maps, not fallback lookup codes. */
export function getDemoRoomMapDirectory(locale: AppLocale): RoomMapBuilding[] {
  return [
    {
      building:
        locale === "en-us" ? "Fictional teaching building" : "虚构教学楼",
      campus: locale === "en-us" ? "Fictional sample campus" : "虚构样例校区",
      floors: [{ floor: "1", codes: ["DEMO-101"] }],
      roomCount: 1,
    },
  ];
}

export function getDemoRoomMapCopy(locale: AppLocale): RoomMapCopy {
  const copy = (locale === "en-us" ? enUs : zhCn).roomMap;
  return {
    ...copy,
    subtitle:
      locale === "en-us"
        ? "Fictional room diagrams for demonstration, not the university’s actual buildings or floor plans."
        : "下方为虚构教室演示示意图，不代表学校真实建筑或楼层布局。",
    sampleRooms: ["DEMO-101", "DEMO-1", "DEMO-NONE"],
  };
}

/** Original normalization and validation apply before exact closed-graph membership. */
export function getDemoRoomMap(
  input: string,
  locale: AppLocale = "zh-cn",
): RoomMap | null {
  const code = roomCodeSchema.parse(input);
  if (code === "DEMO-NONE")
    return {
      code,
      building: null,
      floor: null,
      status: "unavailable",
      imageUrl: null,
      sourceImageUrl: null,
    };
  if (code === "DEMO-1")
    return {
      code,
      building: null,
      floor: null,
      status: "overview",
      imageUrl: `${assetBase}${floorAsset}`,
      sourceImageUrl: `${assetBase}${floorAsset}`,
    };
  if (code !== "DEMO-101") return null;
  return {
    code,
    building: getDemoRoomMapDirectory(locale)[0]?.building ?? null,
    floor: "1",
    status: "highlighted",
    imageUrl: `${assetBase}${highlightedAsset}`,
    sourceImageUrl: `${assetBase}${floorAsset}`,
  };
}

function schematic(highlighted: boolean) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img" aria-labelledby="title description">
<title id="title">DEMO fictional floor schematic / 虚构楼层示意图</title>
<desc id="description">An invented floor with sample classroom DEMO-101. Not a real campus map. 虚构样例教室，不代表真实校区。</desc>
<rect width="640" height="360" fill="#f8fafc"/>
<g font-family="sans-serif" text-anchor="middle" fill="#0f172a">
<text x="320" y="34" font-size="22" font-weight="700">DEMO · FICTIONAL SCHEMATIC</text>
<text x="320" y="60" font-size="17">演示虚构示意图 · 非学校实际布局</text>
<rect x="38" y="86" width="564" height="204" rx="8" fill="#ffffff" stroke="#475569" stroke-width="3"/>
<rect x="55" y="103" width="240" height="110" rx="4" fill="${highlighted ? "#fef3c7" : "#f1f5f9"}" stroke="${highlighted ? "#b45309" : "#64748b"}" stroke-width="${highlighted ? "4" : "2"}"/>
<text x="175" y="151" font-size="23" font-weight="700">DEMO-101</text>
<text x="175" y="180" font-size="16">Sample classroom / 样例教室</text>
<rect x="313" y="103" width="272" height="110" rx="4" fill="#f1f5f9" stroke="#64748b" stroke-width="2"/>
<text x="449" y="151" font-size="20">Fictional room</text><text x="449" y="180" font-size="16">虚构房间</text>
<text x="320" y="258" font-size="19">Sample corridor / 样例走廊</text>
<text x="320" y="326" font-size="17">${highlighted ? "Highlighted classroom / 样例教室定位" : "Floor overview / 虚构楼层概览"}</text>
</g></svg>`;
}

export function getDemoRoomMapAsset(name: string) {
  if (name !== floorAsset && name !== highlightedAsset) return null;
  const bytes = new TextEncoder().encode(schematic(name === highlightedAsset));
  return {
    bytes,
    contentType: "image/svg+xml" as const,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
