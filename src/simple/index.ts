import { renderAsciiPolylines } from "../utils/ascii.js";
import { fillGrid } from "../utils/mockup.js";
import { applyThreshold, marchGrid } from "../utils/utils.js";
import {
  computeAdjacency,
  computeTopology,
  interpolateFromTopology,
  walkSegmentsIntoPolylines,
} from "./helpers.js";

// specify our number of grid cells
const initXDim = 20;
const initYDim = 20;

const thresholds = [-6, 0, 6];

const griddedData = fillGrid(initXDim, initYDim);

const isolines = thresholds
  .map((t) => {
    // THIS IS STEP 1 -- apply a threshold to the 2D field to make a binary 'image'
    const thresholdedGrid = applyThreshold(griddedData, t);

    // THIS IS STEP 2 -- use a 2x2 moving window of pixels to compose a 4-bit cell index (creates an n-1 dimensioned grid of cells)
    const { marchedGrid, marchedXDim, marchedYDim } = marchGrid(thresholdedGrid);

    // THIS IS STEP 3 -- calculate topology from the cell indices via the LUT
    const linesOnGrid = computeTopology(marchedGrid, marchedXDim, marchedYDim, griddedData, t);

    // THIS IS STEP 4 -- use topology to intepolate the exact position of the contour line from the original data
    const interpolatedSegments = interpolateFromTopology(linesOnGrid, griddedData, t);

    const adjacency = computeAdjacency(interpolatedSegments);
    const polylines = walkSegmentsIntoPolylines(adjacency, interpolatedSegments);

    return polylines;
  })
  .flat();

renderAsciiPolylines(isolines, initXDim, initYDim, 2);
