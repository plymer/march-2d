/*

Marching Squares Algorithm Overview

Requirements:
  1) 2D grid of values [with dimensions as a power of 2]
  2) threshold value

<<< already I can see how this can be a parallelized operation >>>

Step 1)

Apply a threshold to the 2D field to make a binary 'image':
   1 where the data is above the threshold value
   0 where the data is below the threshold value
   -- treat data *at* the threshold in a consistent above/below way

Step 2)

Every 2x2 block of pixels in the binary image forms a cell used for contouring - this means that the contouring grid is n-1 pixels smaller in each dimension

Step 3)

Compose the 4 bits at the corners of the cells to build a binary index by walking the outside of the cell in a clockwise direction and appending the bit to the index using bitwise OR and left-shift from the most significant bit at the top left and the least significant bit at the bttom left - the resulting 4-bit index has a range of possible values of 0-15

Step 4)

Look up the cell indices in a pre-built LUT that maps an index to an edge 'case' (shape)

Step 5)

Apply linear interpolation between the original field data values to find the exact position of the contour line along the edges of the cell


*/

import { fillGrid } from "./mockup.js";
import { applyThreshold, marchGrid } from "./utils.js";

// our lookup table of the 16 binary cases for each corner state
// use the 0b leader to denote the binary nature of the number
// 0 is a corner that is below the threshold value
// 1 is a corner that is above the threshold value
const lookupTable = [
  0b0000, 0b0001, 0b0010, 0b0011, 0b0100, 0b0101, 0b0110, 0b0111, 0b1000, 0b1001, 0b1010, 0b1011,
  0b1100, 0b1101, 0b1110, 0b1111,
];

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
marchedGrid.forEach((r) => console.log(r));
