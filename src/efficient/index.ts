import { renderAsciiPolylines } from "../utils/ascii.js";
import { fillGridTypedArray } from "../utils/mockup.js";
import { marchingSquares } from "./helpers.js";

// specify our number of grid cells
const initXDim = 20;
const initYDim = 20;
const thresholds = [-6, 0, 6];

const typedArrayGriddedData = fillGridTypedArray(initXDim, initYDim);

const { polylines: isolines } = marchingSquares(thresholds, typedArrayGriddedData, [
  initXDim,
  initYDim,
]);

renderAsciiPolylines(isolines, initXDim, initYDim, 2);
