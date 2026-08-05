import { describe, expect, test } from "vitest";
import {
  computeMapViewBox,
  layoutCampuses,
} from "@/features/bus/components/bus-transit-map-campus-layout";
import {
  estimateCampusLabelWidth,
  labelOffset,
} from "@/features/bus/components/bus-transit-map-visual";
import { normalizeBusCampusCoordinates } from "@/features/bus/lib/bus-import-route-data";

describe("校车线路图视口裁剪", () => {
  test("空校区回退到默认画布", () => {
    expect(computeMapViewBox(new Map())).toEqual({
      height: 560,
      minX: 0,
      minY: 0,
      width: 900,
    });
  });

  test("视口为侧向标签预留空间避免裁切", () => {
    const campuses = [
      {
        id: 1,
        latitude: 31.83892,
        longitude: 117.268264,
        namePrimary: "东区",
        nameSecondary: null,
      },
      {
        id: 5,
        latitude: 31.826345,
        longitude: 117.129257,
        namePrimary: "先研院",
        nameSecondary: null,
      },
      {
        id: 6,
        latitude: 31.820447,
        longitude: 117.129369,
        namePrimary: "高新",
        nameSecondary: null,
      },
    ];
    const positions = layoutCampuses(campuses);
    const viewBox = computeMapViewBox(positions, campuses);
    for (const campus of campuses) {
      const position = positions.get(campus.id);
      expect(position).toBeDefined();
      const label = labelOffset(position!, campus.namePrimary);
      const width = estimateCampusLabelWidth(campus.namePrimary);
      const anchorX = position!.x + label.dx;
      if (label.textAnchor === "start") {
        expect(viewBox.minX + viewBox.width).toBeGreaterThanOrEqual(
          anchorX + width,
        );
      }
      if (label.textAnchor === "end") {
        expect(viewBox.minX).toBeLessThanOrEqual(anchorX - width);
      }
    }
  });

  test("纠正经纬度写反的静态数据后再投影", () => {
    expect(
      normalizeBusCampusCoordinates({
        latitude: 117.268264,
        longitude: 31.83892,
      }),
    ).toEqual({ latitude: 31.83892, longitude: 117.268264 });

    const positions = layoutCampuses([
      {
        id: 1,
        latitude: 117.268264,
        longitude: 31.83892,
        namePrimary: "东区",
        nameSecondary: null,
      },
      {
        id: 6,
        latitude: 117.129369,
        longitude: 31.820447,
        namePrimary: "高新",
        nameSecondary: null,
      },
    ]);
    const east = positions.get(1);
    const gaoxin = positions.get(6);
    expect(east).toBeDefined();
    expect(gaoxin).toBeDefined();
    // 高新 is west of 东区 → smaller SVG x
    expect(gaoxin!.x).toBeLessThan(east!.x);
  });
});
