import type { Tuple2DWithValue } from "@plymer/fast-barnes-ts";
import fs from "fs/promises";
import path from "path";

import type { Point, PolylinesWithLevels } from "../utils/types.js";

function convertToGeographicCoordinates(lines: Point[], x0: Point, step: number[]): Point[] {
  return lines.map((point) => [x0[0] + point[0] * step[0]!, x0[1] + point[1] * step[1]!]);
}

export async function readInputFromCsv(): Promise<Tuple2DWithValue[]> {
  const csv = await fs.readFile(path.resolve(".", "src", "barnes", "input.csv"), "utf-8");

  const lines = csv.trim().split("\n");
  const pointData = lines.map((line) => {
    const [xStr, yStr, valueStr] = line.split(",");

    if (xStr === undefined || yStr === undefined || valueStr === undefined) {
      throw new Error(`Invalid CSV line: ${line}`);
    }
    return [
      Number.parseFloat(xStr),
      Number.parseFloat(yStr),
      Number.parseFloat(valueStr),
    ] as Tuple2DWithValue;
  });

  return pointData;
}

export function getIsolineThreshold(polylines: PolylinesWithLevels, index: number) {
  return polylines.levelValues[polylines.polylineLevelIndex[index]!];
}

export async function writeToGeoJson(polylines: PolylinesWithLevels, x0: Point, step: number[]) {
  const geoJson = {
    type: "FeatureCollection",
    features: polylines.polylines.map((line, i) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: convertToGeographicCoordinates(line, x0, step),
      },
      properties: {
        value: getIsolineThreshold(polylines, i),
      },
    })),
  };

  const outputPath = path.resolve(".", "src", "barnes", "output.geojson");
  return await fs.writeFile(outputPath, JSON.stringify(geoJson, null, 2), "utf-8");
}

export async function writeTupleGeoJSON(input: unknown) {
  const ouputPath = path.resolve(".", "src", "barnes", "tuple_output.geojson");
  return await fs.writeFile(ouputPath, JSON.stringify(input, null, 2), "utf-8");
}
