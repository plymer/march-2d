import { renderAsciiPolylines } from "../utils/ascii.js";
import { fillGrid } from "../utils/mockup.js";
import { marchingSquaresSimple } from "./helpers.js";

// specify our number of grid cells
const initXDim = 20;
const initYDim = 20;

const thresholds = [-6, 0, 6];

const griddedData = fillGrid(initXDim, initYDim);

const isolines = marchingSquaresSimple(thresholds, griddedData);

renderAsciiPolylines(isolines, initXDim, initYDim, 2);
