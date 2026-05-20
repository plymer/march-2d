/*

Marching Squares Algorithm Overview

Requirements:
  1) 2D grid of values [with dimensions as a power of 2]
  2) threshold value

<<< already I can see how this can be a parallelized operation >>>

KEY POINTS:

 - we take the marched values (cell indices) and use that as the 'topology': which edges are crossed
 - convert the topology in geometry by interpolating a point on EACH EDGE that is crossed using the original field data values (the original scalar values that we thresholded to get the binary grid) to find the exact position of the contour line along the edges of the cell

Step 1)

Apply a threshold to the 2D field to make a binary 'image':
   1 where the data is above the threshold value
   0 where the data is below the threshold value
   -- treat data *at* the threshold in a consistent above/below way

Every 2x2 block of pixels in the binary image forms a cell used for contouring - this means that the contouring grid is n-1 pixels smaller in each dimension

Step 2)

Compose the 4 bits at the corners of the cells to build a binary index by walking the outside of the cell in a clockwise direction and appending the bit to the index using bitwise OR and left-shift from the most significant bit at the top left and the least significant bit at the bttom left - the resulting 4-bit index has a range of possible values of 0-15 --- THIS IS THE CELL INDEX

Step 3)

Look up the cell indices in a pre-built LUT that maps an index to an edge 'case' (shape) --- CALCULATE TOPOLOGY FROM CELL INDICES

Step 4)

Apply linear interpolation between the original field data values to find the exact position of the contour line along the edges of the cell


*/

import { fillGrid } from "./mockup.js";
import {
  applyThreshold,
  marchGrid,
  pointOnEdge,
  renderAsciiSegments,
  resolveAmbiguousCase,
  type SegmentOnCell,
} from "./utils.js";

// our lookup table of the 16 binary cases for each corner state
// use the 0b leader to denote the binary nature of the number
// do NOT handle the ambiguous saddle-point cases of 0b0101 and 0b1010 in the LUT, instead handle those with a separate function that looks at the average value of the cell to determine which topology to use for those cases
const caseToSegments: Partial<Record<number, SegmentOnCell[]>> = {
  0b0001: [["left", "bottom"]],
  0b0010: [["bottom", "right"]],
  0b0011: [["left", "right"]],
  0b0100: [["top", "right"]],
  0b0110: [["top", "bottom"]],
  0b0111: [["left", "top"]],
  0b1000: [["top", "left"]],
  0b1001: [["top", "bottom"]],
  0b1011: [["top", "right"]],
  0b1100: [["left", "right"]],
  0b1101: [["bottom", "right"]],
  0b1110: [["left", "bottom"]],
};

// specify our number of grid cells
const initXDim = 10;
const initYDim = 10;
const threshold = 1;

const griddedData = fillGrid(initXDim, initYDim);

const thresholdedGrid = applyThreshold(griddedData, threshold);

// THIS IS STEP 2 -- use a 2x2 moving window of pixels to compose a 4-bit cell index (creates an n-1 dimensioned grid of cells)
const { marchedGrid, marchedXDim, marchedYDim } = marchGrid(thresholdedGrid);

// THIS IS STEP 3 -- calculate topology from the cell indices via the LUT
const linesOnGrid: { x: number; y: number; segments: SegmentOnCell[] }[] = [];

for (let y = 0; y < marchedYDim; y++) {
  for (let x = 0; x < marchedXDim; x++) {
    const currentPoint = marchedGrid[y]![x];

    if (currentPoint === undefined || currentPoint === 0b0000 || currentPoint === 0b1111) continue; // no line passes through this cell

    let segments = caseToSegments[currentPoint];

    if (!segments) {
      // this specifically handles the saddle points of case 5 and 10
      segments = resolveAmbiguousCase(x, y, currentPoint, griddedData, threshold);
    }
    if (!segments) continue; // if still no segments, skip this cell

    linesOnGrid.push({ x, y, segments });
  }
}

// THIS IS STEP 4 -- use topology to intepolate the exact position of the contour line from the original data
const interpolatedSegments: [[number, number], [number, number]][] = [];

for (const cell of linesOnGrid) {
  for (const [e0, e1] of cell.segments) {
    const p0 = pointOnEdge(cell.x, cell.y, e0, griddedData, threshold);
    const p1 = pointOnEdge(cell.x, cell.y, e1, griddedData, threshold);
    interpolatedSegments.push([p0, p1]);
  }
}

renderAsciiSegments(interpolatedSegments, initXDim, initYDim, 6);
