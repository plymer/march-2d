export function fillGrid(xDim: number, yDim: number) {
  const newGrid: number[][] = [];

  // now loop over and assign a value to each cell that we can contour
  for (let y = 0; y < yDim; y++) {
    newGrid.push([]);
    for (let x = 0; x < xDim; x++) {
      const value = Math.round(Math.sin(y)) + Math.round(Math.cos(x));

      newGrid[y]?.push(value);
    }
  }

  return newGrid;
}
