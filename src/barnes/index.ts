// this file will test integration with @plymer/fast-barnes-ts as an input source

import { marchingSquares } from "../efficient/helpers.js";
import { barnes, getBarnesParams } from "@plymer/fast-barnes-ts";
import { readInputFromCsv, writeToGeoJson } from "./helpers.js";

async function main() {
  const pointTupleArray = await readInputFromCsv();

  const params = getBarnesParams(pointTupleArray, { mode: "euclidean", resolution: 2048 });

  if (!params) {
    throw new Error("Failed to compute Barnes parameters");
  }

  const { data, shape } = barnes(pointTupleArray, 1.5, params.x0, params.step, params.size, {
    maxDist: 3.717,
    numIter: 18,
    method: "optimized_convolution",
  });

  // const thresholds = Array.from({ length: 25 }).map((_, i) => 960 + i * 4);

  const thresholds = Array.from({ length: 21 }).map((_, i) => -50 + i * 5);

  const polylines = marchingSquares(thresholds, data, shape as [number, number]);

  console.log(
    `Computed ${polylines.polylines.length} polylines for the following thresholds: ${polylines.levelValues.join(", ")}`,
  );

  await writeToGeoJson(polylines, params.x0, params.step);
}

await main();
