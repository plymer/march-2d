// this file will test integration with @plymer/fast-barnes-ts as an input source

import { marchingSquares } from "../efficient/helpers.js";
import { barnes, getBarnesParams } from "@plymer/fast-barnes-ts";
import { readInputFromCsv, writeToGeoJson } from "./helpers.js";

const pointTupleArray = await readInputFromCsv();

const params = getBarnesParams(pointTupleArray, {
  mode: "euclidean",
  resolution: [2048, 2048 / 1.45],
});

if (!params) {
  throw new Error("Failed to compute Barnes parameters");
}

const startBarnes = performance.now();

const { data, shape } = barnes(pointTupleArray, 1.5, params.x0, params.step, params.size, {
  maxDist: 3.717,
  numIter: 18,
  method: "optimized_convolution",
});

const endBarnes = performance.now();

console.log(`Barnes interpolation took ${(endBarnes - startBarnes).toFixed(2)} ms`);

if (shape.length !== 2) {
  throw new Error(`Expected shape to be a tuple of length 2, got ${shape.length}`);
}

// const thresholds = Array.from({ length: 26 }).map((_, i) => 960 + i * 4);

const thresholds = Array.from({ length: 21 }).map((_, i) => -50 + i * 5);

const startPoly = performance.now();

const polylines = marchingSquares(thresholds, data, shape as [number, number]);

const endPoly = performance.now();

console.log(`Marching squares took ${(endPoly - startPoly).toFixed(2)} ms`);

console.log(
  `Computed ${polylines.polylines.length} polylines for the following thresholds: ${polylines.levelValues.join(", ")}`,
);

const geoJsonWriteStart = performance.now();
await writeToGeoJson(polylines, params.x0, params.step);

const geoJsonWriteEnd = performance.now();

console.log(`Writing to GeoJSON took ${(geoJsonWriteEnd - geoJsonWriteStart).toFixed(2)} ms`);
