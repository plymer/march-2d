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

Step 2)

Every 2x2 block of pixels in the binary image forms a cell used for contouring - this means that the contouring grid is n-1 pixels smaller in each dimension

Step 3)

Compose the 4 bits at the corners of the cells to build a binary index by walking the outside of the cell in a clockwise direction and appending the bit to the index using bitwise OR and left-shift from the most significant bit at the top left and the least significant bit at the bttom left - the resulting 4-bit index has a range of possible values of 0-15 --- THIS IS THE CELL INDEX

Step 4)

Look up the cell indices in a pre-built LUT that maps an index to an edge 'case' (shape) --- CALCULATE TOPOLOGY FROM CELL INDICES

Step 5)

Apply linear interpolation between the original field data values to find the exact position of the contour line along the edges of the cell


*/

import { fillGrid } from "./mockup.js";
import { applyThreshold, marchGrid, type SegmentOnCell } from "./utils.js";

// our lookup table of the 16 binary cases for each corner state
// use the 0b leader to denote the binary nature of the number

// Minimal LUT: index -> one contour segment crossing 2 edges
// (cases 5 and 10 are ambiguous, intentionally omitted for now)
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
  // 0b1010: [
  //   ["top", "right"],
  //   ["left", "bottom"],
  // ],
  // 0b0101: [
  //   ["top", "left"],
  //   ["bottom", "right"],
  // ],
};

// specify our number of grid cells
const initXDim = 5;
const initYDim = 5;
const threshold = 1;

const griddedData = fillGrid(initXDim, initYDim);

griddedData.forEach((r) => console.log(r));

console.log("");

const thresholdedGrid = applyThreshold(griddedData, threshold);

thresholdedGrid.forEach((r) => console.log(r));

// now we have our grid that is ready to be contoured
// we need to create the contour grid that is n-1 smaller in each dimension by looking up the neighbours in a 2x2 grid (the march starts here)

const marchedGrid = marchGrid(thresholdedGrid);

console.log("");

console.log(marchedGrid);

const marchedYDim = marchedGrid.length;
const marchedXDim = marchedGrid[0]?.length;

if (marchedYDim === undefined || marchedXDim === undefined)
  throw new Error("marchedGrid is invalid");

// skip 0b0000 and 0b1111 because they contain no line information
const linesOnGrid: { x: number; y: number; segments: SegmentOnCell[] }[] = [];

for (let y = 0; y < marchedYDim; y++) {
  for (let x = 0; x < marchedXDim; x++) {
    const currentPoint = marchedGrid[y]![x];

    if (currentPoint === undefined) continue; // skip invalid points

    if (currentPoint === 0b0000 || currentPoint === 0b1111) continue;

    const segments = caseToSegments[currentPoint];
    if (!segments) continue; // skip ambiguous / unhandled case for now

    linesOnGrid.push({ x, y, segments });
  }
}

console.log("cell-edge segments", JSON.stringify(linesOnGrid, null, 2));
