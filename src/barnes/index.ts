// this file will test integration with @plymer/fast-barnes-ts as an input source

import { marchingSquares } from "../efficient/helpers.js";
import { barnes, getBarnesParams, tupleArrayToGeoJSON } from "@plymer/fast-barnes-ts";
import { readInputFromCsv, writeToGeoJson, writeTupleGeoJSON } from "./helpers.js";

const pointTupleArray = await readInputFromCsv();

const params = getBarnesParams(pointTupleArray, {
  mode: "euclidean",
  resolution: [2048, 2048 / 1.45],
});

if (!params) {
  throw new Error("Failed to compute Barnes parameters");
}

const startBarnes = performance.now();

// find the min/max values
// then use the step value (5 degrees C) to create an array of thresholds for the isolines

const { data, shape } = barnes(pointTupleArray, [0.5, 1.0], params.x0, params.step, params.size, {
  maxDist: 3.717,
  numIter: 18,
  method: "optimized_convolution",
});

const endBarnes = performance.now();

if (shape.length !== 2) {
  throw new Error(`Expected shape to be a tuple of length 2, got ${shape.length}`);
}

const startPoly = performance.now();

const thresholdStep = 5;

const tupleMinMax = pointTupleArray.reduce(
  (acc, tuple) => {
    const value = tuple[2]!;
    if (value < acc.min) {
      acc.min = value;
    }
    if (value > acc.max) {
      acc.max = value;
    }
    return acc;
  },
  { min: Infinity, max: -Infinity } as { min: number; max: number },
);

const thresholds =
  tupleMinMax.min === tupleMinMax.max
    ? [tupleMinMax.min]
    : Array.from({
        length: Math.ceil((tupleMinMax.max - tupleMinMax.min) / thresholdStep) + 1,
      }).map((_, i) => tupleMinMax.min - (tupleMinMax.min % thresholdStep) + i * thresholdStep);

const polylines = marchingSquares(thresholds, data, shape as [number, number]);
const endPoly = performance.now();

const elapsed = endBarnes - startBarnes + endPoly - startPoly;

console.log(`My time: ${elapsed.toFixed(2)} ms for ${polylines.polylines.length} isolines`);

await writeToGeoJson(polylines, params.x0, params.step);

const d3contourStart = performance.now();
const tupleGeoJSON = tupleArrayToGeoJSON(pointTupleArray, "isolines", {
  resolution: [2048, 2048 / 1.45],
  contourOptions: { spacing: 5, base: -50 },
  barnesOptions: {
    maxDist: 3.717,
    numIter: 18,
    method: "optimized_convolution",
  },
  sigma: [0.5, 1.0],
  ...params,
  coordinateMode: "euclidean",
});

const d3contourEnd = performance.now();

console.log(
  `D3 time: ${(d3contourEnd - d3contourStart).toFixed(2)} ms for ${tupleGeoJSON.features.length} isolines`,
);

console.log(
  `\nMy implementation was ${Math.round((1 - (d3contourEnd - d3contourStart) / elapsed) * -100 * 100) / 100}% faster than current D3 implementation\n`,
);

await writeTupleGeoJSON(tupleGeoJSON);
